import { useEffect, useState } from 'react'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

const LANG_COLORS = {
  python: '#3b82f6', javascript: '#f59e0b', typescript: '#06b6d4',
  java: '#ef4444', go: '#22d3ee', dart: '#a78bfa', html: '#fb923c',
  css: '#ec4899', rust: '#f97316', ruby: '#dc2626', php: '#8b5cf6',
  swift: '#f59e0b', kotlin: '#7c3aed', shell: '#6b7280', c: '#64748b',
}

function langColor(lang) {
  return LANG_COLORS[(lang || '').toLowerCase()] || '#7c3aed'
}

function daysAgo(n) {
  if (!n && n !== 0) return '—'
  if (n === 0) return 'today'
  if (n === 1) return '1d ago'
  if (n < 30) return `${n}d ago`
  if (n < 365) return `${Math.round(n / 30)}mo ago`
  return `${Math.round(n / 365)}y ago`
}

function Section({ title, children, delay = 0 }) {
  return (
    <div style={{
      marginBottom: '20px',
      opacity: 0,
      animation: `fadeInUp 0.35s ease ${delay}s both`,
    }}>
      <div style={{
        fontSize: '10px', fontWeight: '700', color: '#9ca3af',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: FONT, marginBottom: '10px',
        paddingBottom: '6px', borderBottom: '1px solid #f3f4f6',
      }}>{title}</div>
      {children}
    </div>
  )
}

export default function ProfilePanel({ username, refreshTick = 0 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    fetch(`/api/graph/profile?username=${username}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [username, refreshTick])

  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%', background: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
          <div style={{
            width: '22px', height: '22px', border: '2px solid #e5e7eb',
            borderTopColor: '#7c3aed', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 10px',
          }} />
          Loading profile…
        </div>
      </div>
    )
  }

  if (!data || !data.developer) {
    return (
      <div style={{
        width: '100%', height: '100%', background: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🌱</div>
          No profile data yet.<br />Try searching for issues first.
        </div>
      </div>
    )
  }

  const { developer, skills, repos, following, maintainers } = data

  return (
    <div style={{
      width: '100%', height: '100%', background: '#ffffff',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        animation: 'fadeIn 0.3s ease both',
      }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#111827', fontFamily: FONT }}>
          GitHub Profile
        </span>
        <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
          {repos.length} repos · {skills.length} skills
        </span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>

        {/* Developer card */}
        <div style={{
          display: 'flex', gap: '14px', alignItems: 'flex-start',
          padding: '16px', borderRadius: '10px',
          border: '1px solid #e5e7eb',
          marginBottom: '20px', background: '#fafafa',
          opacity: 0, animation: 'fadeInUp 0.35s ease 0.05s both',
        }}>
          <img
            src={`https://github.com/${developer.username}.png?size=72`}
            alt={developer.username}
            style={{
              width: '52px', height: '52px', borderRadius: '50%',
              border: '2px solid #e5e7eb', flexShrink: 0,
              objectFit: 'cover',
            }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', fontFamily: FONT }}>
              {developer.name || developer.username}
            </div>
            <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '600', marginBottom: '5px', fontFamily: FONT }}>
              @{developer.username}
            </div>
            {developer.bio && (
              <div style={{
                fontSize: '11px', color: '#6b7280', lineHeight: '1.5',
                marginBottom: '6px', fontFamily: FONT,
              }}>{developer.bio}</div>
            )}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {developer.location && (
                <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                  📍 {developer.location}
                </span>
              )}
              {developer.followers > 0 && (
                <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                  👥 {developer.followers} followers
                </span>
              )}
              <a
                href={developer.github_url || `https://github.com/${developer.username}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '10px', color: '#7c3aed', fontWeight: '600',
                  textDecoration: 'none', fontFamily: FONT,
                }}
              >
                GitHub ↗
              </a>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        {skills.length > 0 && (
          <Section title={`Tech Stack · ${skills.length} skills`} delay={0.1}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {skills.map((s, i) => (
                <span key={s.name} style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                  fontWeight: '600', fontFamily: FONT,
                  background: langColor(s.name) + '15',
                  color: langColor(s.name),
                  border: `1px solid ${langColor(s.name)}30`,
                  opacity: 0,
                  animation: `fadeIn 0.3s ease ${0.12 + i * 0.03}s both`,
                }}>{s.name}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Repositories */}
        {repos.length > 0 && (
          <Section title={`Your Repositories · ${repos.length}`} delay={0.15}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {repos.map((repo, i) => (
                <a
                  key={repo.full_name}
                  href={`https://github.com/${repo.full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none', display: 'block',
                    padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #e5e7eb', background: '#ffffff',
                    transition: 'all 0.15s', cursor: 'pointer',
                    opacity: 0,
                    animation: `fadeInUp 0.3s ease ${0.17 + i * 0.04}s both`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.08)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontWeight: '700', fontSize: '12px', color: '#111827', fontFamily: FONT }}>
                      {repo.name || repo.full_name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {repo.primary_language && (
                        <span style={{
                          fontSize: '10px', fontWeight: '600', fontFamily: FONT,
                          color: langColor(repo.primary_language),
                          background: langColor(repo.primary_language) + '15',
                          padding: '1px 6px', borderRadius: '4px',
                        }}>{repo.primary_language}</span>
                      )}
                      <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                        ⭐ {repo.stars}
                      </span>
                    </div>
                  </div>
                  {repo.description && (
                    <div style={{
                      fontSize: '11px', color: '#6b7280', lineHeight: '1.4',
                      marginBottom: '4px', fontFamily: FONT,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{repo.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                      🕐 {daysAgo(repo.last_commit_days_ago)}
                    </span>
                    {repo.open_issues_count > 0 && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                        ⚡ {repo.open_issues_count} open issues
                      </span>
                    )}
                    {repo.forks > 0 && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                        🍴 {repo.forks}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Maintainers */}
        {maintainers.length > 0 && (
          <Section title="Maintainers in Graph" delay={0.2}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {maintainers.map((m, i) => (
                <div key={m.username + i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid #e5e7eb', background: '#fafafa',
                  opacity: 0,
                  animation: `fadeInUp 0.3s ease ${0.22 + i * 0.04}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={`https://github.com/${m.username}.png?size=32`}
                      alt={m.username}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #e5e7eb' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827', fontFamily: FONT }}>
                        @{m.username}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontFamily: FONT }}>
                        {m.repo}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                    background: m.avg_response_days <= 7 ? '#dcfce7' : '#fef9c3',
                    color: m.avg_response_days <= 7 ? '#16a34a' : '#ca8a04',
                    fontWeight: '600', fontFamily: FONT,
                  }}>
                    ~{m.avg_response_days}d response
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Following */}
        {following.length > 0 && (
          <Section title={`Following · ${following.length}`} delay={0.25}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
              {following.map((u, i) => (
                <a
                  key={u}
                  href={`https://github.com/${u}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 8px 4px 4px', borderRadius: '20px',
                    border: '1px solid #e5e7eb', background: '#ffffff',
                    textDecoration: 'none', transition: 'all 0.15s',
                    opacity: 0,
                    animation: `fadeIn 0.3s ease ${0.27 + i * 0.03}s both`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'
                    e.currentTarget.style.background = 'rgba(124,58,237,0.04)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.background = '#ffffff'
                  }}
                >
                  <img
                    src={`https://github.com/${u}.png?size=24`}
                    alt={u}
                    style={{ width: '18px', height: '18px', borderRadius: '50%' }}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <span style={{ fontSize: '10px', fontWeight: '600', color: '#374151', fontFamily: FONT }}>
                    {u}
                  </span>
                </a>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
