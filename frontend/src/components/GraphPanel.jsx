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

// Base radii — drawn larger so labels fit
const NODE_R = {
  Developer:  10,
  Repository: 7,
  Skill:      8,
  Maintainer: 6,
  Issue:      5,
  Topic:      4,
}

function displayName(node) {
  if (node.type === 'Repository') {
    const parts = (node.name || '').split('/')
    return parts.length > 1 ? parts[1] : node.name
  }
  const n = node.name || ''
  return n.length > 16 ? n.slice(0, 15) + '…' : n
}

export default function GraphPanel({ username, highlightIds = [] }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [tooltip, setTooltip] = useState(null)
  const [dims, setDims] = useState({ w: 600, h: 500 })
  const containerRef = useRef(null)
  const fgRef = useRef(null)

  // Load data — seed all nodes near center to prevent escape
  useEffect(() => {
    if (!username) return
    fetch(`/api/graph/data?username=${username}`)
      .then(r => r.json())
      .then(data => {
        const seeded = {
          ...data,
          nodes: data.nodes.map(n => ({
            ...n,
            x: (Math.random() - 0.5) * 40,
            y: (Math.random() - 0.5) * 40,
          })),
        }
        setGraphData(seeded)
      })
  }, [username])

  // Tune forces
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !graphData.nodes.length) return
    try {
      fg.d3Force('charge')?.strength(-40)
      fg.d3Force('link')?.distance(18).strength(1)
      fg.d3Force('center')?.strength(0.1)
    } catch {}
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

  const highlightSet = new Set(highlightIds)

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isHighlighted = highlightSet.has(node.id)
    const isDev = node.type === 'Developer'
    const r = NODE_R[node.type] ?? 4
    const color = NODE_COLORS[node.type] || '#8b949e'
    const label = displayName(node)

    // Glow for developer and highlighted nodes
    if (isDev || isHighlighted) {
      ctx.shadowColor = isHighlighted ? '#ffd700' : color
      ctx.shadowBlur = isDev ? 14 : 10
    }

    // Circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = isHighlighted ? '#ffd700' : color
    ctx.fill()
    ctx.shadowBlur = 0

    // White ring for developer
    if (isDev) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Label — always show for Developer/highlighted, show for others when zoomed enough
    const showLabel = isDev || isHighlighted || globalScale >= 1.8
    if (!showLabel) return

    const fontSize = Math.max(6, (isDev ? 11 : 9) / globalScale)
    ctx.font = `${isDev ? 'bold ' : ''}${fontSize}px Verdana, sans-serif`
    const textW = ctx.measureText(label).width
    const pad = 3
    const bx = node.x - textW / 2 - pad
    const by = node.y + r + 2
    const bh = fontSize + pad * 2

    // Label pill background
    ctx.fillStyle = 'rgba(10,15,26,0.82)'
    ctx.beginPath()
    ctx.roundRect(bx, by, textW + pad * 2, bh, 3)
    ctx.fill()

    ctx.fillStyle = isHighlighted ? '#ffd700' : isDev ? '#da77f2' : '#cbd5e1'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(label, node.x, by + pad)
  }, [highlightIds])

  const linkColor = useCallback(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source
    const t = typeof link.target === 'object' ? link.target.id : link.target
    return highlightSet.has(s) && highlightSet.has(t)
      ? 'rgba(255,215,0,0.7)'
      : 'rgba(255,255,255,0.18)'
  }, [highlightIds])

  const linkWidth = useCallback(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source
    const t = typeof link.target === 'object' ? link.target.id : link.target
    return highlightSet.has(s) && highlightSet.has(t) ? 2 : 0.7
  }, [highlightIds])

  const typeCounts = graphData.nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ width: '100%', height: '100%', background: '#080d14', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        background: 'rgba(8,13,20,0.8)',
      }}>
        <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: '700', fontFamily: 'Verdana, sans-serif' }}>
          Live Graph — FalkorDB
        </span>
        <span style={{ color: '#475569', fontSize: '11px', fontFamily: 'Verdana, sans-serif' }}>
          {graphData.nodes.length} nodes · {graphData.links.length} edges
        </span>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '6px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
        background: 'rgba(8,13,20,0.5)',
      }}>
        {Object.entries(NODE_COLORS).map(([type, color]) =>
          typeCounts[type] ? (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b', fontFamily: 'Verdana, sans-serif' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {type} <strong style={{ color: '#94a3b8' }}>{typeCounts[type]}</strong>
            </span>
          ) : null
        )}
        {highlightIds.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#ffd700', fontFamily: 'Verdana, sans-serif' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffd700', display: 'inline-block' }} />
            Path
          </span>
        )}
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.4}
          warmupTicks={120}
          cooldownTicks={60}
          enableNodeDrag={false}
          nodePointerAreaPaint={(node, color, ctx) => {
            const r = (NODE_R[node.type] ?? 4) + 8
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
            ctx.fill()
          }}
          onEngineStop={() => {
            const fg = fgRef.current
            if (!fg) return
            setGraphData(prev => ({
              ...prev,
              nodes: prev.nodes.map(n => ({ ...n, fx: n.x ?? 0, fy: n.y ?? 0 })),
            }))
            fg.zoomToFit(500, 40)
          }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: '#10182a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '12px 16px',
            fontSize: '12px', color: '#e6edf3', pointerEvents: 'none',
            zIndex: 10, maxWidth: '210px', minWidth: '150px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: 'Verdana, sans-serif',
          }}>
            <span style={{
              display: 'inline-block', background: (NODE_COLORS[tooltip.type] || '#8b949e') + '22',
              color: NODE_COLORS[tooltip.type] || '#8b949e',
              borderRadius: '10px', padding: '1px 8px', fontSize: '10px', fontWeight: '700',
              marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{tooltip.type}</span>
            <div style={{ fontWeight: '700', marginBottom: '6px', wordBreak: 'break-word', fontSize: '13px' }}>
              {tooltip.name}
            </div>
            {Object.entries(tooltip.props || {}).map(([k, v]) =>
              v != null ? (
                <div key={k} style={{ color: '#64748b', fontSize: '11px', marginTop: '3px' }}>
                  <span style={{ color: '#58a6ff' }}>{k}:</span> {String(v)}
                </div>
              ) : null
            )}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 10, left: 14, color: '#1e2a3a', fontSize: '10px', pointerEvents: 'none', fontFamily: 'Verdana, sans-serif' }}>
          Scroll to zoom · Hover for details
        </div>
      </div>

      {/* Footer stats */}
      <div style={{
        padding: '7px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', gap: '14px', flexShrink: 0, background: 'rgba(8,13,20,0.6)', flexWrap: 'wrap',
      }}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type} style={{ fontSize: '11px', color: '#475569', fontFamily: 'Verdana, sans-serif' }}>
            <span style={{ color: NODE_COLORS[type] || '#8b949e' }}>●</span>{' '}
            {type} <strong style={{ color: '#94a3b8' }}>{count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
