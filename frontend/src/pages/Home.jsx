import { useState, useEffect } from 'react'

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
      background: 'radial-gradient(ellipse at 60% 0%, #1a1040 0%, #0d1117 55%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '480px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
            marginBottom: '20px', fontSize: '28px',
            boxShadow: '0 0 40px rgba(124,58,237,0.35)',
          }}>🔗</div>
          <h1 style={{
            fontSize: '38px', fontWeight: '800', letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #e2d9f3, #93c5fd)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '10px',
          }}>ContriGraph</h1>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.5' }}>
            Find your path in open source.<br />
            <span style={{ color: '#94a3b8' }}>Powered by graph intelligence.</span>
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(22,27,34,0.8)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '24px', lineHeight: '1.6' }}>
            Connect your GitHub account to discover open source issues tailored to your skills and connections.
          </p>

          {oauthEnabled ? (
            <button
              onClick={handleGitHubLogin}
              disabled={githubLoading}
              style={{
                width: '100%', padding: '14px',
                background: githubLoading ? '#1a1f24' : '#24292f',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: '#fff', fontSize: '14px', fontWeight: '600',
                cursor: githubLoading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!githubLoading) e.currentTarget.style.background = '#363d44' }}
              onMouseLeave={e => { if (!githubLoading) e.currentTarget.style.background = '#24292f' }}
            >
              {githubLoading ? <LoadingSpinner /> : <GitHubIcon />}
              {githubLoading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
            </button>
          ) : (
            <div style={{
              padding: '14px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', fontSize: '13px', textAlign: 'center',
            }}>
              GitHub OAuth not configured. Set GITHUB_CLIENT_ID in backend .env
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
          {[
            { icon: '🧠', text: 'Graph-powered matching' },
            { icon: '⚡', text: 'Maintainer activity' },
            { icon: '🤝', text: 'Social connection paths' },
            { icon: '💾', text: 'Persistent memory' },
          ].map(f => (
            <span key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px', padding: '6px 12px',
              color: '#64748b', fontSize: '12px',
            }}>
              {f.icon} {f.text}
            </span>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: '#374151', fontSize: '11px', marginTop: '24px' }}>
          FalkorDB · FastAPI · Claude · MCP · React
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </p>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: '16px', height: '16px',
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
