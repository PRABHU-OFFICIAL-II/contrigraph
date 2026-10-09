import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const NODE_COLORS = {
  Developer:  '#da77f2',
  Repository: '#f0883e',
  Skill:      '#58a6ff',
  Issue:      '#3fb950',
  Maintainer: '#ffa657',
  Topic:      '#8b949e',
}

const NODE_R = {
  Developer:  10,
  Repository:  6,
  Skill:       7,
  Maintainer:  5,
  Issue:       4,
  Topic:       3,
}

function displayName(node) {
  if (node.type === 'Repository') {
    const parts = (node.name || '').split('/')
    return parts.length > 1 ? parts[1] : node.name
  }
  const n = node.name || ''
  return n.length > 18 ? n.slice(0, 17) + '…' : n
}

export default function GraphPanel({ username, highlightIds = [] }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [tooltip, setTooltip] = useState(null)
  const [dims, setDims] = useState({ w: 600, h: 500 })
  const containerRef = useRef(null)
  const fgRef = useRef(null)
  const highlightSet = new Set(highlightIds)

  useEffect(() => {
    if (!username) return
    fetch(`/api/graph/data?username=${username}`)
      .then(r => r.json())
      .then(data => setGraphData(data))
  }, [username])

  // Configure forces after data loads
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !graphData.nodes.length) return
    try {
      fg.d3Force('charge')?.strength(-120)
      fg.d3Force('link')?.distance(55).strength(0.6)
      fg.d3Force('center')?.strength(0.05)
    } catch {}
    // Zoom to fit after physics settles
    setTimeout(() => fg.zoomToFit(800, 32), 2500)
  }, [graphData.nodes.length])

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const hl = highlightSet.has(node.id)
    const isDev = node.type === 'Developer'
    const r = NODE_R[node.type] ?? 4
    const color = NODE_COLORS[node.type] || '#8b949e'
    const label = displayName(node)

    // Glow
    if (isDev || hl) {
      ctx.shadowColor = hl ? '#ffd700' : color
      ctx.shadowBlur = 12
    }

    // Circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = hl ? '#ffd700' : color
    ctx.fill()
    ctx.shadowBlur = 0

    // White ring for current user's Developer node
    if (isDev) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Labels: always for Developer/highlighted; others at zoom ≥ 1.5
    const showLabel = isDev || hl || globalScale >= 1.5
    if (!showLabel) return

    const fontSize = Math.max(7, (isDev ? 11 : 9) / globalScale)
    ctx.font = `${isDev ? '700 ' : ''}${fontSize}px Verdana, sans-serif`

    const tw = ctx.measureText(label).width
    const lx = node.x - tw / 2
    const ly = node.y + r + 3

    // Dark pill background for readability
    ctx.fillStyle = 'rgba(8,13,20,0.85)'
    ctx.fillRect(lx - 2, ly, tw + 4, fontSize + 3)

    ctx.fillStyle = hl ? '#ffd700' : isDev ? '#e0b8ff' : '#e2e8f0'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(label, node.x, ly + 1)
  }, [highlightIds])

  const linkColor = useCallback(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source
    const t = typeof link.target === 'object' ? link.target.id : link.target
    return highlightSet.has(s) && highlightSet.has(t) ? 'rgba(255,215,0,0.8)' : 'rgba(255,255,255,0.2)'
  }, [highlightIds])

  const linkWidth = useCallback(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source
    const t = typeof link.target === 'object' ? link.target.id : link.target
    return highlightSet.has(s) && highlightSet.has(t) ? 2 : 0.8
  }, [highlightIds])

  const typeCounts = graphData.nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ width: '100%', height: '100%', background: '#080d14', display: 'flex', flexDirection: 'column', fontFamily: 'Verdana, sans-serif' }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: '700' }}>Live Graph — FalkorDB</span>
        <span style={{ color: '#475569', fontSize: '11px' }}>
          {graphData.nodes.length} nodes · {graphData.links.length} edges
        </span>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '6px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        {Object.entries(NODE_COLORS).map(([type, color]) =>
          typeCounts[type] ? (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#64748b' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {type} <strong style={{ color: '#94a3b8' }}>{typeCounts[type]}</strong>
            </span>
          ) : null
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {graphData.nodes.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: '12px' }}>
            Loading graph…
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dims.w}
            height={dims.h}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            onNodeHover={node => setTooltip(node || null)}
            backgroundColor="#080d14"
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTime={3000}
            enableNodeDrag={true}
            nodePointerAreaPaint={(node, color, ctx) => {
              const r = (NODE_R[node.type] ?? 4) + 10
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
              ctx.fill()
            }}
          />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: '#10182a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '12px 14px',
            fontSize: '12px', color: '#e6edf3', pointerEvents: 'none',
            zIndex: 10, maxWidth: '200px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              display: 'inline-block',
              background: (NODE_COLORS[tooltip.type] || '#8b949e') + '22',
              color: NODE_COLORS[tooltip.type] || '#8b949e',
              borderRadius: '8px', padding: '1px 8px', fontSize: '10px',
              fontWeight: '700', marginBottom: '6px',
            }}>{tooltip.type}</div>
            <div style={{ fontWeight: '700', marginBottom: '4px', wordBreak: 'break-word' }}>
              {tooltip.name}
            </div>
            {Object.entries(tooltip.props || {}).map(([k, v]) =>
              v != null ? (
                <div key={k} style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                  <span style={{ color: '#58a6ff' }}>{k}:</span> {String(v)}
                </div>
              ) : null
            )}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 8, left: 12, color: '#1e2a3a', fontSize: '10px', pointerEvents: 'none' }}>
          Scroll to zoom · Drag nodes · Hover for details
        </div>
      </div>
    </div>
  )
}
