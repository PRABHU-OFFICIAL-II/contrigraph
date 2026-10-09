import { useEffect, useRef, useState, useCallback } from 'react'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

const COMPLEXITY_COLOR = {
  beginner:     '#16a34a',
  starter:      '#16a34a',
  intermediate: '#d97706',
  advanced:     '#dc2626',
}
function complexityColor(c) {
  return COMPLEXITY_COLOR[(c || '').toLowerCase()] || '#6b7280'
}

const NODE_R = { repo: 12, issue: 6, maintainer: 8 }

/* Convert /api/graph/exploration payload → {nodes, links} for canvas */
function buildGraph(data) {
  const nodes = []
  const links = []
  const repos = data.repos || []

  repos.forEach((repo, ri) => {
    const repoId = `repo_${ri}`
    nodes.push({ id: repoId, kind: 'repo', label: repo.full_name?.split('/')[1] || repo.full_name, full_name: repo.full_name, stars: repo.stars, response_days: repo.avg_response_days, x: 0, y: 0 })

    if (repo.maintainer) {
      const mId = `m_${ri}`
      nodes.push({ id: mId, kind: 'maintainer', label: repo.maintainer, response_days: repo.avg_response_days, x: 0, y: 0 })
      links.push({ source: repoId, target: mId })
    }

    ;(repo.issues || []).forEach((iss, ii) => {
      const issId = `iss_${ri}_${ii}`
      nodes.push({ id: issId, kind: 'issue', label: iss.title, url: iss.url, complexity: iss.complexity, x: 0, y: 0 })
      links.push({ source: repoId, target: issId })
    })
  })

  /* Layout: repos in a ring, their children fanning out */
  const repoNodes = nodes.filter(n => n.kind === 'repo')
  const repoRing = 130

  repoNodes.forEach((rn, ri) => {
    const angle = repoNodes.length === 1
      ? -Math.PI / 2
      : (ri / repoNodes.length) * 2 * Math.PI - Math.PI / 2
    rn.x = Math.cos(angle) * repoRing
    rn.y = Math.sin(angle) * repoRing

    const children = links.filter(l => l.source === rn.id).map(l => nodes.find(n => n.id === l.target))
    const childRing = 80
    children.forEach((cn, ci) => {
      if (!cn) return
      const spread = children.length === 1 ? 0 : ((ci / children.length) - 0.5) * Math.PI * 0.9
      const childAngle = angle + spread
      cn.x = rn.x + Math.cos(childAngle) * childRing
      cn.y = rn.y + Math.sin(childAngle) * childRing
    })
  })

  return { nodes, links }
}

function nodeColor(node) {
  if (node.kind === 'repo') return '#0891b2'
  if (node.kind === 'maintainer') return '#d97706'
  return complexityColor(node.complexity)
}

function nodeRadius(node) {
  return NODE_R[node.kind] || 6
}

export default function ExplorationPanel({ username, refreshTick = 0 }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [fetching, setFetching] = useState(false)
  const [repoCount, setRepoCount] = useState(0)
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const stateRef = useRef({ zoom: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0 })
  const [tooltip, setTooltip] = useState(null)
  const [drawTick, setDrawTick] = useState(0)
  const nodeMap = useRef({})

  function fetchData() {
    if (!username) return
    setFetching(true)
    fetch(`/api/graph/exploration?username=${username}`)
      .then(r => r.json())
      .then(d => {
        const gd = buildGraph(d)
        setGraphData(gd)
        setRepoCount(d.repos?.length || 0)
        nodeMap.current = {}
        gd.nodes.forEach(n => { nodeMap.current[n.id] = n })
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }

  useEffect(() => { fetchData() }, [username, refreshTick])

  /* Draw */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !graphData.nodes.length) return
    if (!canvas.width || !canvas.height) return
    const ctx = canvas.getContext('2d')
    const { zoom, panX, panY } = stateRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY)
    ctx.scale(zoom, zoom)

    /* Edges */
    for (const link of graphData.links) {
      const src = nodeMap.current[link.source]
      const tgt = nodeMap.current[link.target]
      if (!src || !tgt) continue
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = tgt.kind === 'maintainer' ? 'rgba(217,119,6,0.3)' : 'rgba(8,145,178,0.2)'
      ctx.lineWidth = 1 / zoom
      ctx.stroke()
    }

    /* Nodes */
    for (const node of graphData.nodes) {
      const r = nodeRadius(node)
      const col = nodeColor(node)

      if (node.kind === 'repo') {
        ctx.shadowColor = col + '60'
        ctx.shadowBlur = 14 / zoom
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
      ctx.fillStyle = col
      ctx.globalAlpha = 0.9
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0

      if (node.kind === 'repo') {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2 / zoom
        ctx.stroke()
      }

      /* Labels for repo nodes and maintainers */
      if (node.kind === 'repo' || node.kind === 'maintainer') {
        const label = node.label?.length > 16 ? node.label.slice(0, 15) + '…' : node.label || ''
        const fontSize = Math.max(7, (node.kind === 'repo' ? 10 : 8) / zoom)
        ctx.font = `${node.kind === 'repo' ? '700 ' : ''}${fontSize}px Verdana, sans-serif`
        const tw = ctx.measureText(label).width
        const lx = node.x
        const ly = node.y + r + 3 / zoom
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.fillRect(lx - tw / 2 - 2 / zoom, ly, tw + 4 / zoom, fontSize + 3 / zoom)
        ctx.fillStyle = node.kind === 'repo' ? '#0e7490' : '#92400e'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(label, lx, ly + 1 / zoom)
      }
    }

    ctx.restore()
  }, [graphData, drawTick, tooltip])

  /* Resize observer */
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function fit() {
      if (!graphData.nodes.length || !canvas.width || !canvas.height) return
      const xs = graphData.nodes.map(n => n.x)
      const ys = graphData.nodes.map(n => n.y)
      const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60
      const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 60
      const z = Math.min(canvas.width / (maxX - minX), canvas.height / (maxY - minY)) * 0.82
      stateRef.current = { ...stateRef.current, zoom: z, panX: -((minX + maxX) / 2) * z, panY: -((minY + maxY) / 2) * z }
      setDrawTick(c => c + 1)
    }

    function resize() {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      fit()
    }

    const obs = new ResizeObserver(resize)
    obs.observe(container)
    resize()
    const t = setTimeout(resize, 400)
    return () => { obs.disconnect(); clearTimeout(t) }
  }, [graphData])

  function redraw() { setDrawTick(c => c + 1) }

  function worldPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const { zoom, panX, panY } = stateRef.current
    return {
      x: (e.clientX - rect.left - canvas.width / 2 - panX) / zoom,
      y: (e.clientY - rect.top - canvas.height / 2 - panY) / zoom,
    }
  }

  function hitNode(wx, wy) {
    for (const node of [...graphData.nodes].reverse()) {
      const r = nodeRadius(node) + 4
      const dx = wx - node.x, dy = wy - node.y
      if (dx * dx + dy * dy <= r * r) return node
    }
    return null
  }

  function onMouseMove(e) {
    const s = stateRef.current
    if (s.dragging) {
      s.panX += e.clientX - s.lastX; s.panY += e.clientY - s.lastY
      s.lastX = e.clientX; s.lastY = e.clientY
      redraw()
    } else {
      const { x, y } = worldPos(e)
      setTooltip(hitNode(x, y) || null)
    }
  }
  function onMouseDown(e) { stateRef.current.dragging = true; stateRef.current.lastX = e.clientX; stateRef.current.lastY = e.clientY }
  function onMouseUp() { stateRef.current.dragging = false }
  function onWheel(e) {
    e.preventDefault()
    const s = stateRef.current
    const f = e.deltaY < 0 ? 1.1 : 0.91
    const nz = Math.max(0.2, Math.min(8, s.zoom * f))
    s.panX = s.panX * (nz / s.zoom); s.panY = s.panY * (nz / s.zoom); s.zoom = nz
    redraw()
  }

  const isEmpty = graphData.nodes.length === 0

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#ffffff', borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: FONT,
    }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, background: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            background: repoCount > 0 ? '#0891b2' : '#d1d5db',
            animation: repoCount > 0 ? 'livePulse 1.6s ease-in-out infinite' : 'none',
          }} />
          <span style={{ color: '#111827', fontSize: '12px', fontWeight: '700', fontFamily: FONT }}>
            Live Exploration Graph
          </span>
          <span style={{
            fontSize: '10px', fontWeight: '700', fontFamily: FONT,
            background: repoCount > 0 ? '#cffafe' : '#f3f4f6',
            color: repoCount > 0 ? '#0e7490' : '#9ca3af',
            padding: '2px 8px', borderRadius: '20px',
          }}>{repoCount} repos explored</span>
        </div>
        <button
          onClick={fetchData}
          title="Refresh"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: fetching ? '#0891b2' : '#94a3b8', fontSize: '14px', lineHeight: 1,
            animation: fetching ? 'spin 0.8s linear infinite' : 'none',
          }}
          onMouseEnter={e => { if (!fetching) e.currentTarget.style.color = '#0891b2' }}
          onMouseLeave={e => { if (!fetching) e.currentTarget.style.color = '#94a3b8' }}
        >↻</button>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap',
        padding: '5px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)',
        flexShrink: 0, background: '#fafafa',
      }}>
        {[['Repo (explored)', '#0891b2'], ['Maintainer', '#d97706'], ['Beginner issue', '#16a34a'], ['Intermediate', '#d97706'], ['Advanced', '#dc2626']].map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#64748b', fontFamily: FONT }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: isEmpty ? 'default' : 'grab' }}>

        {isEmpty ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#cbd5e1', fontFamily: FONT, userSelect: 'none',
          }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: '12px', opacity: 0.3 }}>
              <circle cx="40" cy="40" r="12" fill="#0891b2" />
              {[0,1,2,3,4,5].map(i => {
                const a = (i/6)*2*Math.PI - Math.PI/2
                return <g key={i}>
                  <line x1="40" y1="40" x2={40+Math.cos(a)*28} y2={40+Math.sin(a)*28} stroke="#0891b2" strokeWidth="1.5" />
                  <circle cx={40+Math.cos(a)*28} cy={40+Math.sin(a)*28} r="5" fill="#16a34a" />
                </g>
              })}
            </svg>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', marginBottom: '4px' }}>No exploration yet</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', textAlign: 'center', maxWidth: '200px', lineHeight: '1.5' }}>
              Ask the agent for issues — this graph updates live
            </div>
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
          <div style={{
            position: 'absolute', top: 10, right: 10, maxWidth: '220px',
            background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '10px', padding: '10px 12px',
            fontSize: '12px', color: '#1e293b', pointerEvents: 'none',
            zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            fontFamily: FONT,
          }}>
            <div style={{
              display: 'inline-block', marginBottom: '5px',
              background: nodeColor(tooltip) + '18',
              color: nodeColor(tooltip),
              borderRadius: '6px', padding: '1px 8px',
              fontSize: '10px', fontWeight: '700', textTransform: 'capitalize',
            }}>{tooltip.kind}</div>
            <div style={{ fontWeight: '700', marginBottom: '3px', wordBreak: 'break-word', fontSize: '12px' }}>
              {tooltip.kind === 'repo' ? tooltip.full_name : tooltip.label}
            </div>
            {tooltip.kind === 'repo' && (
              <div style={{ color: '#64748b', fontSize: '11px' }}>
                ⭐ {tooltip.stars || 0} · ⚡ {tooltip.response_days <= 1 ? '<1 day' : `${Math.round(tooltip.response_days)}d`} response
              </div>
            )}
            {tooltip.kind === 'issue' && tooltip.url && (
              <div style={{ color: '#0891b2', fontSize: '10px', marginTop: '3px' }}>Click to open on GitHub ↗</div>
            )}
            {tooltip.kind === 'maintainer' && (
              <div style={{ color: '#64748b', fontSize: '11px' }}>avg response: {tooltip.response_days <= 1 ? '<1 day' : `${Math.round(tooltip.response_days)} days`}</div>
            )}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 8, left: 12, color: '#e2e8f0', fontSize: '10px', pointerEvents: 'none', fontFamily: FONT }}>
          Scroll to zoom · Drag to pan · Hover for details
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
