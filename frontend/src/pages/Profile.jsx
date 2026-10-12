import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getDeveloperStats } from '../utils/api.js'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

const SKILL_COLORS = {
  language: '#7c3aed', framework: '#0891b2', devops: '#d97706',
  database: '#16a34a', ml: '#dc2626', api: '#9333ea', other: '#6b7280',
}

const ACTION_STYLES = {
  viewed:     { icon: '👁', label: 'Viewed',     color: '#6b7280', bg: '#f3f4f6' },
  bookmarked: { icon: '🔖', label: 'Bookmarked', color: '#d97706', bg: '#fef3c7' },
  skipped:    { icon: '⏭',  label: 'Skipped',    color: '#9ca3af', bg: '#f9fafb' },
  applied:    { icon: '✅', label: 'Applied',    color: '#16a34a', bg: '#dcfce7' },
}

export default function Profile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDeveloperStats(username).then(data => {
      setStats(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [username])

  const T = {
    bg: '#0f172a', surface: '#1e293b', surface2: '#162032',
    border: '#334155', text: '#e2e8f0', textMuted: '#94a3b8', textSubtle: '#64748b',
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT, padding: '32px 24px', color: T.text }}>
      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(`/search/${username}`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.textMuted, borderRadius: '8px', padding: '6px 14px',
            fontSize: '12px', cursor: 'pointer', fontFamily: FONT, marginBottom: '24px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted }}
        >
          ← Back to Search
        </button>

        {/* Developer header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: '800', color: '#fff', flexShrink: 0,
          }}>
            {username[0]?.toUpperCase()}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: T.text, fontFamily: FONT }}>
              @{username}
            </h1>
            <div style={{ fontSize: '12px', color: T.textMuted, marginTop: '4px', fontFamily: FONT }}>
              GitHub Developer · ContriGraph Knowledge Graph
            </div>
          </div>
          <a
            href={`https://github.com/${username}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              marginLeft: 'auto', padding: '7px 16px', borderRadius: '8px',
              border: '1px solid #7c3aed', color: '#7c3aed', background: 'transparent',
              fontSize: '12px', textDecoration: 'none', fontFamily: FONT, fontWeight: '600',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7c3aed' }}
          >
            View on GitHub
          </a>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: T.textMuted, fontSize: '14px' }}>
            Loading graph data...
          </div>
        ) : !stats ? (
          <div style={{ textAlign: 'center', padding: '60px', color: T.textMuted, fontSize: '14px' }}>
            No graph data found. <a href="#" onClick={() => navigate(`/search/${username}`)} style={{ color: '#7c3aed' }}>Explore issues first.</a>
          </div>
        ) : (
          <>
            {/* Action stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
              {Object.entries(stats.action_counts || {}).map(([action, count]) => {
                const s = ACTION_STYLES[action] || ACTION_STYLES.viewed
                return (
                  <div key={action} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: '12px', padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ fontSize: '20px' }}>{s.icon}</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: s.color, fontFamily: FONT, lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: '11px', color: T.textMuted, fontFamily: FONT, textTransform: 'capitalize' }}>{s.label}</div>
                  </div>
                )
              })}
            </div>

            {/* Graph size stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
                border: '1px solid #5b21b6', borderRadius: '12px', padding: '20px',
              }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#c4b5fd', fontFamily: FONT }}>{stats.graph_size?.issues ?? 0}</div>
                <div style={{ fontSize: '12px', color: '#a78bfa', marginTop: '4px', fontFamily: FONT }}>Issues in your graph</div>
                <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '6px', fontFamily: FONT }}>matched to your skills via FalkorDB</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #164e63, #0c1a2e)',
                border: '1px solid #0891b2', borderRadius: '12px', padding: '20px',
              }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#67e8f9', fontFamily: FONT }}>{stats.graph_size?.repos ?? 0}</div>
                <div style={{ fontSize: '12px', color: '#22d3ee', marginTop: '4px', fontFamily: FONT }}>Repos in your graph</div>
                <div style={{ fontSize: '11px', color: '#0891b2', marginTop: '6px', fontFamily: FONT }}>linked via skill graph traversal</div>
              </div>
            </div>

            {/* Skills */}
            {stats.skills?.length > 0 && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: '12px', padding: '20px', marginBottom: '24px',
              }}>
                <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '700', color: T.textMuted, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Skills in Knowledge Graph
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {stats.skills.map((s, i) => (
                    <span key={i} style={{
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
                      fontFamily: FONT, fontWeight: '600',
                      background: (SKILL_COLORS[s.category] || '#6b7280') + '22',
                      color: SKILL_COLORS[s.category] || '#6b7280',
                      border: `1px solid ${(SKILL_COLORS[s.category] || '#6b7280')}44`,
                    }}>
                      {s.name}
                      <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px' }}>{s.category}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top repos explored */}
            {stats.top_repos?.length > 0 && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: '12px', padding: '20px',
              }}>
                <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '700', color: T.textMuted, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Repos Explored
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.top_repos.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: '8px',
                      background: T.surface2, border: `1px solid ${T.border}`,
                    }}>
                      <a
                        href={`https://github.com/${r.full_name}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#7c3aed', fontFamily: FONT, fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {r.full_name}
                      </a>
                      <span style={{ fontSize: '11px', color: T.textMuted, fontFamily: FONT }}>
                        ⭐ {r.stars?.toLocaleString() ?? '–'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
