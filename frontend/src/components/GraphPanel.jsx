import { useEffect, useRef, useState } from 'react'

const NODE_COLORS = {
  Developer:  '#7c3aed',
  Repository: '#f0883e',
  Skill:      '#2563eb',
  Issue:      '#16a34a',
  Maintainer: '#d97706',
  Topic:      '#64748b',
}

const LIGHT = {
  bg: '#f9fafb', surface: '#ffffff', surface2: '#fafafa',
  border: '#e5e7eb', border2: '#f3f4f6',
  text: '#111827', textMuted: '#6b7280', textSubtle: '#9ca3af', textFaint: '#d1d5db',
  canvasBg: '#ffffff', edge: 'rgba(0,0,0,0.12)',
  labelBg: 'rgba(255,255,255,0.9)',
  labelText: '#374151', labelDev: '#4c1d95',
}
const DARK = {
  bg: '#0f172a', surface: '#1e293b', surface2: '#162032',
  border: '#334155', border2: '#243044',
  text: '#e2e8f0', textMuted: '#94a3b8', textSubtle: '#64748b', textFaint: '#475569',
  canvasBg: '#0f172a', edge: 'rgba(148,163,184,0.12)',
  labelBg: 'rgba(15,23,42,0.88)',
  labelText: '#94a3b8', labelDev: '#c4b5fd',
}

function nodeColor(node) {
  if (node.type === 'Repository' && node.props?.explored) return '#0891b2'
  return NODE_COLORS[node.type] || '#64748b'
}

const NODE_R = {
  Developer:  11,
  Repository:  7,
  Skill:       8,
  Maintainer:  6,
  Issue:       5,
  Topic:       4,
}

function layoutNodes(data, currentUser) {
  const byType = {}
  for (const n of data.nodes) {
    if (n.type === 'Developer' && currentUser && n.name !== currentUser) continue
    ;(byType[n.type] = byType[n.type] || []).push(n)
  }
  const circle = (nodes, r) =>
    nodes.map((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
      return { ...n, x: Math.cos(angle) * r, y: Math.sin(angle) * r }
    })
  const devs        = (byType.Developer  || []).map(n => ({ ...n, x: 0, y: 0 }))
  const repos       = circle(byType.Repository  || [], 140)
  const skills      = circle(byType.Skill       || [], 250)
  const maintainers = circle(byType.Maintainer  || [], 320)
  const issues      = circle(byType.Issue       || [], 390)
  const topics      = circle(byType.Topic       || [], 450)
  return { ...data, nodes: [...devs, ...repos, ...skills, ...maintainers, ...issues, ...topics] }
}

function displayName(node) {
  if (node.type === 'Repository') {
    const parts = (node.name || '').split('/')
    return parts.length > 1 ? parts[1] : node.name
  }
  const n = node.name || ''
  return n.length > 18 ? n.slice(0, 17) + '…' : n
}

export default function GraphPanel({ username, highlightIds = [], visible = true, refreshTick = 0, hideHeader = false, darkMode }) {
  const T = darkMode ? DARK : LIGHT
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)
  const stateRef     = useRef({ zoom: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0 })
  const [tooltip, setTooltip] = useState(null)
  const [drawTick, setDrawTick] = useState(0)
  const highlightSet = new Set(highlightIds)

  const nodeMap = {}
  for (const n of graphData.nodes) nodeMap[n.id] = n

  const [fetching, setFetching] = useState(false)

  function fetchGraph() {
    if (!username) return
    setFetching(true)
    fetch(`/api/graph/data?username=${username}`)
      .then(r => r.json())
      .then(data => { setGraphData(layoutNodes(data, username)); setFetching(false) })
      .catch(() => setFetching(false))
  }

  useEffect(() => {
    if (!visible) return
    fetchGraph()
  }, [username, visible, refreshTick])

  // ── Draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !graphData.nodes.length) return
    if (!canvas.width || !canvas.height) return
    const ctx = canvas.getContext('2d')
    const { zoom, panX, panY } = stateRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = T.canvasBg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY)
    ctx.scale(zoom, zoom)

    // Draw edges
    const ARROW_LEN = 7
    const ARROW_ANGLE = Math.PI / 6
    for (const link of graphData.links) {
      const src = nodeMap[link.source] || nodeMap[link.source?.id]
      const tgt = nodeMap[link.target] || nodeMap[link.target?.id]
      if (!src || !tgt) continue
      const hl = highlightSet.has(src.id) && highlightSet.has(tgt.id)
      const color = hl ? 'rgba(124,58,237,0.8)' : T.edge
      const lw = (hl ? 2 : 1) / zoom

      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue
      const ux = dx / len
      const uy = dy / len

      const tgtR = NODE_R[tgt.type] ?? 5
      const ex = tgt.x - ux * tgtR
      const ey = tgt.y - uy * tgtR

      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(ex, ey)
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.stroke()

      const aLen = ARROW_LEN / zoom
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(
        ex - aLen * Math.cos(Math.atan2(uy, ux) - ARROW_ANGLE),
        ey - aLen * Math.sin(Math.atan2(uy, ux) - ARROW_ANGLE)
      )
      ctx.moveTo(ex, ey)
      ctx.lineTo(
        ex - aLen * Math.cos(Math.atan2(uy, ux) + ARROW_ANGLE),
        ey - aLen * Math.sin(Math.atan2(uy, ux) + ARROW_ANGLE)
      )
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.stroke()
    }

    // Draw nodes then labels
    for (const node of graphData.nodes) {
      const hl  = highlightSet.has(node.id)
      const isDev = node.type === 'Developer'
      const r   = NODE_R[node.type] ?? 5
      const col = nodeColor(node)

      if (isDev || hl) {
        ctx.shadowColor = hl ? col : col + '60'
        ctx.shadowBlur  = 12 / zoom
      }
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
      ctx.fillStyle = col
      ctx.globalAlpha = hl ? 1 : 0.85
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0

      if (isDev) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth   = 2 / zoom
        ctx.stroke()
      }

      const showLabel = isDev || hl || node.type === 'Repository' || node.type === 'Skill'
      if (!showLabel && zoom < 2.5) continue
      const label    = displayName(node)
      const fontSize = Math.max(6, (isDev ? 11 : node.type === 'Repository' ? 9 : 8) / zoom)
      ctx.font       = `${isDev ? '700 ' : ''}${fontSize}px Verdana, sans-serif`
      const tw       = ctx.measureText(label).width
      const lx       = node.x - tw / 2
      const ly       = node.y + r + 3 / zoom

      ctx.fillStyle = T.labelBg
      ctx.fillRect(lx - 2 / zoom, ly, tw + 4 / zoom, fontSize + 3 / zoom)
      ctx.fillStyle   = hl ? col : isDev ? T.labelDev : T.labelText
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, node.x, ly + 1 / zoom)
    }

    ctx.restore()
  }, [graphData, highlightIds, tooltip, drawTick, darkMode])

  // ── Resize + initial fit ──────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    function fit() {
      if (!graphData.nodes.length) return
      if (!canvas.width || !canvas.height) return
      const xs = graphData.nodes.map(n => n.x)
      const ys = graphData.nodes.map(n => n.y)
      const minX = Math.min(...xs) - 40
      const maxX = Math.max(...xs) + 40
      const minY = Math.min(...ys) - 40
      const maxY = Math.max(...ys) + 40
      const scaleX = canvas.width  / (maxX - minX)
      const scaleY = canvas.height / (maxY - minY)
      const zoom   = Math.min(scaleX, scaleY) * 0.88
      const panX   = -((minX + maxX) / 2) * zoom
      const panY   = -((minY + maxY) / 2) * zoom
      stateRef.current = { ...stateRef.current, zoom, panX, panY }
      setDrawTick(c => c + 1)
    }

    function resize() {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
      fit()
    }

    const obs = new ResizeObserver(resize)
    obs.observe(container)
    resize()
    const t = setTimeout(() => { resize() }, 400)
    return () => { obs.disconnect(); clearTimeout(t) }
  }, [graphData])

  function redraw() { setDrawTick(c => c + 1) }

  function worldPos(e) {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const { zoom, panX, panY } = stateRef.current
    const cx = canvas.width  / 2
    const cy = canvas.height / 2
    return {
      x: (e.clientX - rect.left - cx - panX) / zoom,
      y: (e.clientY - rect.top  - cy - panY) / zoom,
    }
  }

  function hitNode(wx, wy) {
    for (const node of [...graphData.nodes].reverse()) {
      const r  = (NODE_R[node.type] ?? 5) + 4
      const dx = wx - node.x
      const dy = wy - node.y
      if (dx * dx + dy * dy <= r * r) return node
    }
    return null
  }

  function onMouseMove(e) {
    const s = stateRef.current
    if (s.dragging) {
      s.panX += e.clientX - s.lastX
      s.panY += e.clientY - s.lastY
      s.lastX = e.clientX
      s.lastY = e.clientY
      redraw()
    } else {
      const { x, y } = worldPos(e)
      setTooltip(hitNode(x, y) || null)
    }
  }

  function onMouseDown(e) {
    stateRef.current.dragging = true
    stateRef.current.lastX    = e.clientX
    stateRef.current.lastY    = e.clientY
  }

  function onMouseUp() { stateRef.current.dragging = false }

  function onWheel(e) {
    e.preventDefault()
    const s   = stateRef.current
    const factor = e.deltaY < 0 ? 1.1 : 0.91
    const newZoom = Math.max(0.2, Math.min(8, s.zoom * factor))
    s.panX = (s.panX) * (newZoom / s.zoom)
    s.panY = (s.panY) * (newZoom / s.zoom)
    s.zoom = newZoom
    redraw()
  }

  const typeCounts = graphData.nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1; return acc
  }, {})

  return (
    <div style={{ width: '100%', height: '100%', background: T.surface, display: 'flex', flexDirection: 'column', fontFamily: 'Verdana, sans-serif' }}>

      {/* Header */}
      {!hideHeader && (
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: T.surface }}>
          <span style={{ color: T.text, fontSize: '11px', fontWeight: '700' }}>Graph — FalkorDB</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: T.textMuted, fontSize: '11px' }}>{graphData.nodes.length} nodes · {graphData.links.length} edges</span>
            <button
              onClick={fetchGraph}
              title="Refresh graph"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                color: fetching ? '#7c3aed' : T.textMuted, fontSize: '14px', lineHeight: 1,
                transition: 'color 0.2s',
                animation: fetching ? 'spin 0.8s linear infinite' : 'none',
              }}
              onMouseEnter={e => { if (!fetching) e.currentTarget.style.color = '#7c3aed' }}
              onMouseLeave={e => { if (!fetching) e.currentTarget.style.color = T.textMuted }}
            >↻</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '6px 16px', borderBottom: `1px solid ${T.border2}`, flexShrink: 0, background: T.surface2 }}>
        {Object.entries(NODE_COLORS).map(([type, color]) =>
          typeCounts[type] ? (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: T.textMuted }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {type} <strong style={{ color: T.text }}>{typeCounts[type]}</strong>
            </span>
          ) : null
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: T.textMuted }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0891b2', display: 'inline-block' }} />
          Explored
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: 'grab' }}>
        {graphData.nodes.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: '12px' }}>
            Loading graph…
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ display: 'block' }}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: T.text, pointerEvents: 'none', zIndex: 10, maxWidth: '200px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'inline-block', background: (NODE_COLORS[tooltip.type] || '#64748b') + '18', color: NODE_COLORS[tooltip.type] || '#64748b', borderRadius: '8px', padding: '1px 8px', fontSize: '10px', fontWeight: '700', marginBottom: '6px' }}>{tooltip.type}</div>
            <div style={{ fontWeight: '700', marginBottom: '4px', wordBreak: 'break-word', color: T.text }}>{tooltip.name}</div>
            {Object.entries(tooltip.props || {}).map(([k, v]) =>
              v != null ? (
                <div key={k} style={{ color: T.textMuted, fontSize: '11px', marginTop: '2px' }}>
                  <span style={{ color: '#2563eb' }}>{k}:</span> {String(v)}
                </div>
              ) : null
            )}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 8, left: 12, color: T.border, fontSize: '10px', pointerEvents: 'none' }}>
          Scroll to zoom · Drag to pan · Hover for details
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
