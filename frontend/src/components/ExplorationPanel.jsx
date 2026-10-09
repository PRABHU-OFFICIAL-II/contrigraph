import { useEffect, useState, useRef } from 'react'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

const COMPLEXITY_COLOR = {
  beginner: '#16a34a',
  starter: '#16a34a',
  intermediate: '#d97706',
  advanced: '#dc2626',
}

function complexityColor(c) {
  return COMPLEXITY_COLOR[(c || '').toLowerCase()] || '#6b7280'
}

function responseLabel(days) {
  if (!days && days !== 0) return '—'
  if (days <= 1) return '⚡ <1 day'
  if (days <= 7) return `${Math.round(days)}d`
  return `${Math.round(days)}d`
}

/* ── Mini SVG graph for one repo node ── */
function RepoGraph({ repo, index }) {
  const issues = repo.issues || []
  const cx = 60, cy = 60
  const r = 46
  const spokes = issues.map((iss, i) => {
    const angle = issues.length === 1
      ? -Math.PI / 2
      : (i / issues.length) * 2 * Math.PI - Math.PI / 2
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      ...iss,
    }
  })

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      {spokes.map((s, i) => (
        <line key={i} x1={cx} y1={cy} x2={s.x} y2={s.y}
          stroke="rgba(8,145,178,0.25)" strokeWidth="1.2" />
      ))}
      {spokes.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r="5"
          fill={complexityColor(s.complexity)} opacity="0.9"
          style={{ animation: `nodeFloat 2.5s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      {/* repo hub */}
      <circle cx={cx} cy={cy} r="13" fill="#0891b2" />
      <circle cx={cx} cy={cy} r="13" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5" />
    </svg>
  )
}

export default function ExplorationPanel({ username, refreshTick = 0 }) {
  const [data, setData] = useState({ repos: [] })
  const [loading, setLoading] = useState(false)
  const prevCount = useRef(0)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    fetch(`/api/graph/exploration?username=${username}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        prevCount.current = d.repos?.length || 0
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [username, refreshTick])

  const repos = data.repos || []

  return (
    <div style={{
      width: '260px', minWidth: '260px',
      background: '#ffffff', borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: repos.length > 0 ? '#0891b2' : '#d1d5db',
            display: 'inline-block',
            animation: repos.length > 0 ? 'livePulse 1.6s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#111827', fontFamily: FONT }}>
            Live Exploration
          </span>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: '700', fontFamily: FONT,
          background: repos.length > 0 ? '#cffafe' : '#f3f4f6',
          color: repos.length > 0 ? '#0e7490' : '#9ca3af',
          padding: '2px 8px', borderRadius: '20px',
        }}>
          {repos.length} repos
        </span>
      </div>

      {/* Empty state */}
      {repos.length === 0 && !loading && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center',
          animation: 'fadeIn 0.3s ease both',
        }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: '12px', opacity: 0.35 }}>
            <circle cx="28" cy="28" r="10" fill="#0891b2" />
            {[0,1,2,3,4].map(i => {
              const a = (i/5)*2*Math.PI - Math.PI/2
              return <g key={i}>
                <line x1="28" y1="28" x2={28+Math.cos(a)*20} y2={28+Math.sin(a)*20}
                  stroke="#0891b2" strokeWidth="1.5" />
                <circle cx={28+Math.cos(a)*20} cy={28+Math.sin(a)*20} r="4" fill="#16a34a" />
              </g>
            })}
          </svg>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px', fontFamily: FONT }}>
            No exploration yet
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.5', fontFamily: FONT }}>
            Ask the agent for issues and this graph will update live
          </div>
        </div>
      )}

      {loading && repos.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: '18px', height: '18px', border: '2px solid #e5e7eb',
            borderTopColor: '#0891b2', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )}

      {/* Repo cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {repos.map((repo, idx) => (
          <div key={repo.full_name} style={{
            borderRadius: '10px', border: '1px solid #e5e7eb',
            overflow: 'hidden', background: '#fafafa',
            opacity: 0,
            animation: `fadeInUp 0.35s ease ${idx * 0.06}s both`,
          }}>
            {/* Repo header */}
            <div style={{
              padding: '8px 10px',
              background: 'linear-gradient(135deg, #ecfeff 0%, #f0fdff 100%)',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: '11px', fontWeight: '700', color: '#0e7490',
                  textDecoration: 'none', fontFamily: FONT,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: '140px',
                }}>
                {repo.full_name}
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <span style={{ fontSize: '9px', color: '#6b7280', fontFamily: FONT }}>⭐ {repo.stars || 0}</span>
              </div>
            </div>

            {/* Mini graph + stats row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <div style={{ flexShrink: 0 }}>
                <RepoGraph repo={repo} index={idx} />
              </div>
              <div style={{ flex: 1, padding: '0 10px 0 2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '9px', color: '#9ca3af', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issues explored</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: '#0e7490', fontFamily: FONT, lineHeight: 1 }}>
                    {repo.viewed_count}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '9px', color: '#9ca3af', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maintainer</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '700', fontFamily: FONT,
                    color: (repo.avg_response_days || 0) <= 1 ? '#16a34a' : '#d97706',
                  }}>
                    {responseLabel(repo.avg_response_days)}
                  </span>
                </div>
              </div>
            </div>

            {/* Issues list */}
            {repo.issues?.length > 0 && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {repo.issues.map((iss, i) => (
                  <a key={i} href={iss.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '5px',
                      textDecoration: 'none', padding: '2px 0',
                      opacity: 0, animation: `fadeIn 0.25s ease ${0.1 + i * 0.05}s both`,
                    }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '3px',
                      background: complexityColor(iss.complexity),
                    }} />
                    <span style={{
                      fontSize: '10px', color: '#374151', fontFamily: FONT,
                      lineHeight: '1.4', overflow: 'hidden',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {iss.title}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Complexity legend */}
      {repos.length > 0 && (
        <div style={{
          padding: '8px 12px', borderTop: '1px solid #f3f4f6',
          display: 'flex', gap: '10px', flexShrink: 0,
        }}>
          {[['beginner', '#16a34a'], ['intermediate', '#d97706'], ['advanced', '#dc2626']].map(([label, color]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ fontSize: '9px', color: '#9ca3af', fontFamily: FONT }}>{label}</span>
            </span>
          ))}
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes nodeFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}
