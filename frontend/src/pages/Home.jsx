import { useState, useEffect } from 'react'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

export default function Home() {
  const [githubLoading, setGithubLoading] = useState(false)
  const [oauthEnabled, setOauthEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/auth/github/user')
      .then(r => r.json())
      .then(d => setOauthEnabled(d.oauth_enabled))
      .catch(() => {})
  }, [])

  function handleGitHubLogin() {
    setGithubLoading(true)
    window.location.href = '/api/auth/github/login'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: FONT,
    }}>
      <div style={{
        maxWidth: '440px', width: '100%',
        animation: 'fadeInUp 0.45s ease both',
      }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px', borderRadius: '16px',
            background: '#7c3aed', fontSize: '26px', marginBottom: '18px',
          }}>🔗</div>
          <h1 style={{
            fontSize: '32px', fontWeight: '800', color: '#111827',
            letterSpacing: '-0.03em', marginBottom: '8px', fontFamily: FONT,
          }}>ContriGraph</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', fontFamily: FONT }}>
            Find your path in open source.<br />Powered by graph intelligence.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff', border: '1px solid #e5e7eb',
          borderRadius: '14px', padding: '28px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          animation: 'fadeInUp 0.45s ease 0.08s both',
        }}>
          <p style={{
            color: '#6b7280', fontSize: '13px', textAlign: 'center',
            marginBottom: '22px', lineHeight: '1.7', fontFamily: FONT,
          }}>
            Connect your GitHub account to discover issues tailored to your skills and social graph.
          </p>

          {oauthEnabled ? (
            <button
              onClick={handleGitHubLogin}
              disabled={githubLoading}
              style={{
                width: '100%', padding: '13px 20px',
                background: githubLoading ? '#374151' : '#24292f',
                border: 'none', borderRadius: '10px',
                color: '#ffffff', fontSize: '13px', fontWeight: '700',
                cursor: githubLoading ? 'not-allowed' : 'pointer',
                fontFamily: FONT, letterSpacing: '0.02em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => { if (!githubLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#363d44' } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = githubLoading ? '#374151' : '#24292f' }}
            >
              {githubLoading ? <Spinner /> : <GitHubIcon />}
              {githubLoading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
            </button>
          ) : (
            <div style={{
              padding: '13px', borderRadius: '10px',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#dc2626', fontSize: '12px', textAlign: 'center', fontFamily: FONT,
            }}>
              GitHub OAuth not configured — set GITHUB_CLIENT_ID in backend .env
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            <span style={{ color: '#9ca3af', fontSize: '11px', fontFamily: FONT }}>powered by</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '12px' }}>
            {['FalkorDB', 'FastAPI', 'Claude AI', 'React'].map((t, i) => (
              <span key={t} style={{
                color: '#7c3aed', fontSize: '10px', fontWeight: '700',
                fontFamily: FONT, letterSpacing: '0.03em',
                opacity: 0, animation: `fadeIn 0.3s ease ${0.25 + i * 0.07}s both`,
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Feature pills */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap',
          justifyContent: 'center', marginTop: '18px',
        }}>
          {[
            { icon: '🧠', text: 'Multi-hop graph matching' },
            { icon: '⚡', text: 'Maintainer activity' },
            { icon: '🤝', text: 'Social connections' },
            { icon: '💾', text: 'Session memory' },
          ].map((f, i) => (
            <span key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: '#ffffff', border: '1px solid #e5e7eb',
              borderRadius: '20px', padding: '6px 12px',
              color: '#6b7280', fontSize: '11px', fontFamily: FONT,
              opacity: 0, animation: `fadeInUp 0.3s ease ${0.3 + i * 0.07}s both`,
              transition: 'all 0.18s ease', cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {f.icon} {f.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '15px', height: '15px',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
