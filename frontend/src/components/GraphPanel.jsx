import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const NODE_COLORS = {
  Developer: '#da77f2',
  Repository: '#f0883e',
  Skill: '#58a6ff',
  Issue: '#3fb950',
  Maintainer: '#ffa657',
  Topic: '#8b949e',
}

const NODE_SIZES = {
  Developer: 7,
  Repository: 4,
  Skill: 5,
  Issue: 3,
  Maintainer: 4,
  Topic: 2,
}

function shortName(node) {
  if (node.type === 'Repository') {
    // Show only repo name, drop "username/" prefix
    const parts = node.name?.split('/')
    return parts?.length > 1 ? parts[1] : node.name
  }
  return node.name?.length > 18 ? node.name.slice(0, 18) + '…' : node.name
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: '#0d1117',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    background: 'rgba(10,15,26,0.6)',
  },
  title: { color: '#e2e8f0', fontSize: '12px', fontWeight: '700', letterSpacing: '0.01em' },
  subtitle: { color: '#475569', fontSize: '11px' },
  legend: {
    display: 'flex', gap: '14px', flexWrap: 'wrap',
    padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
    background: 'rgba(10,15,26,0.3)',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' },
  dot: (color) => ({ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }),
  graphWrap: { flex: 1, overflow: 'hidden', position: 'relative' },
  tooltip: {
    position: 'absolute',
    top: 12, right: 12,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '12px',
    color: '#e6edf3',
    pointerEvents: 'none',
    zIndex: 10,
    maxWidth: '200px',
    minWidth: '140px',
  },
  typeBadge: (color) => ({
    display: 'inline-block',
    background: color + '22',
    color,
    borderRadius: '10px',
    padding: '1px 8px',
    fontSize: '10px',
    fontWeight: '600',
    marginBottom: '5px',
  }),
  hint: {
    position: 'absolute', bottom: 28, left: 14,
    color: '#374151', fontSize: '10px', pointerEvents: 'none',
  },
  footer: {
    padding: '8px 16px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    display: 'flex', gap: '14px', flexShrink: 0,
    background: 'rgba(10,15,26,0.4)',
  },
  stat: { fontSize: '11px', color: '#64748b' },
}

export default function GraphPanel({ username, highlightIds = [] }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [tooltip, setTooltip] = useState(null)
  const [dims, setDims] = useState({ w: 600, h: 500 })
  const containerRef = useRef(null)
  const fgRef = useRef(null)

  useEffect(() => {
    if (!username) return
    fetch(`/api/graph/data?username=${username}`)
      .then(r => r.json())
      .then(data => {
        // Pre-position ALL nodes close to center so isolated nodes can't escape outward
        const seeded = {
          ...data,
          nodes: data.nodes.map(n => ({
            ...n,
            x: (Math.random() - 0.5) * 60,
            y: (Math.random() - 0.5) * 60,
          })),
        }
        setGraphData(seeded)
      })
  }, [username])

  // Tune forces once data arrives
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !graphData.nodes.length) return
    try {
      fg.d3Force('charge')?.strength(-50)   // weaker repulsion
      fg.d3Force('link')?.distance(22).strength(0.9)
      fg.d3Force('center')?.strength(0.08)  // gentle pull to center
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
    const r = NODE_SIZES[node.type] ?? 3
    const scaledR = isHighlighted ? r * 1.8 : r

    // Draw circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, scaledR, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || NODE_COLORS[node.type] || '#8b949e'

    if (isHighlighted) {
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 14
    } else if (isDev) {
      ctx.shadowColor = node.color
      ctx.shadowBlur = 8
    }
    ctx.fill()
    ctx.shadowBlur = 0

    // Border for developer nodes
    if (isDev) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // Labels: only show at higher zoom, or always for Developer/highlighted
    const showLabel = globalScale >= 2.5 || isDev || isHighlighted
    if (showLabel) {
      const label = shortName(node)
      const fontSize = Math.max(7, isDev ? 11 : 9) / globalScale
      ctx.font = `${isDev ? 'bold ' : ''}${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      // Label background for readability
      const textW = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(13,17,23,0.75)'
      ctx.fillRect(node.x - textW / 2 - 2, node.y + scaledR + 1, textW + 4, fontSize + 2)

      ctx.fillStyle = isHighlighted ? '#ffd700' : isDev ? '#da77f2' : '#e6edf3'
      ctx.fillText(label, node.x, node.y + scaledR + 2)
    }
  }, [highlightIds])

  const linkColor = useCallback(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source
    const t = typeof link.target === 'object' ? link.target.id : link.target
    return highlightSet.has(s) && highlightSet.has(t) ? '#ffd700' : 'rgba(255,255,255,0.25)'
  }, [highlightIds])

  const linkWidth = useCallback(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source
    const t = typeof link.target === 'object' ? link.target.id : link.target
    return highlightSet.has(s) && highlightSet.has(t) ? 2 : 0.6
  }, [highlightIds])

  const typeCounts = graphData.nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1
    return acc
  }, {})

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Live Graph — FalkorDB</span>
        <span style={styles.subtitle}>
          {graphData.nodes.length} nodes · {graphData.links.length} edges
        </span>
      </div>

      <div style={styles.legend}>
        {Object.entries(NODE_COLORS).map(([type, color]) =>
          typeCounts[type] ? (
            <span key={type} style={styles.legendItem}>
              <span style={styles.dot(color)} />
              {type} <span style={{ color: '#e6edf3', fontWeight: '600' }}>{typeCounts[type]}</span>
            </span>
          ) : null
        )}
        {highlightIds.length > 0 && (
          <span style={styles.legendItem}>
            <span style={styles.dot('#ffd700')} />
            Traversed
          </span>
        )}
      </div>

      <div ref={containerRef} style={styles.graphWrap}>
        <ForceGraph2D
          ref={fgRef}
          width={dims.w}
          height={dims.h}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalArrowLength={2.5}
          linkDirectionalArrowRelPos={1}
          onNodeHover={node => setTooltip(node || null)}
          backgroundColor="#0d1117"
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.4}
          warmupTicks={100}
          cooldownTicks={80}
          enableNodeDrag={false}
          onEngineStop={() => {
            const fg = fgRef.current
            if (!fg) return
            // Freeze nodes in settled positions
            setGraphData(prev => ({
              ...prev,
              nodes: prev.nodes.map(n => ({ ...n, fx: n.x ?? 0, fy: n.y ?? 0 })),
            }))
            fg.zoomToFit(600, 40)
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            // Generous hit area so all nodes are hoverable at any zoom level
            const r = (NODE_SIZES[node.type] ?? 3) + 10
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
            ctx.fill()
          }}
        />

        {tooltip && (
          <div style={styles.tooltip}>
            <div style={styles.typeBadge(NODE_COLORS[tooltip.type] || '#8b949e')}>
              {tooltip.type}
            </div>
            <div style={{ fontWeight: '600', marginBottom: '4px', wordBreak: 'break-word' }}>
              {tooltip.name}
            </div>
            {Object.entries(tooltip.props || {}).map(([k, v]) =>
              v != null ? (
                <div key={k} style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>
                  <span style={{ color: '#58a6ff' }}>{k}:</span> {String(v)}
                </div>
              ) : null
            )}
          </div>
        )}

        <div style={styles.hint}>Scroll to zoom · Hover for details</div>
      </div>

      <div style={styles.footer}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type} style={styles.stat}>
            <span style={{ color: NODE_COLORS[type] || '#8b949e' }}>●</span>{' '}
            {type} <strong style={{ color: '#e6edf3' }}>{count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
