import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const STEPS = [
  { icon: '🔗', text: 'Connected to GitHub' },
  { icon: '📡', text: 'Fetching your repositories…' },
  { icon: '🧠', text: 'Building your skill graph…' },
  { icon: '🕸', text: 'Mapping social connections…' },
  { icon: '✅', text: 'Graph ready — launching ContriGraph!' },
]

export default function Loading() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const username = params.get('username') || ''
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!username) { navigate('/'); return }

    // Advance steps every 900ms
    const stepTimer = setInterval(() => {
      setStep(prev => {
        if (prev >= STEPS.length - 1) { clearInterval(stepTimer); return prev }
        return prev + 1
      })
    }, 900)

    // Redirect after all steps complete
    const redirectTimer = setTimeout(() => {
      setDone(true)
      setTimeout(() => navigate(`/search/${username}`), 400)
    }, STEPS.length * 900 + 200)

    return () => { clearInterval(stepTimer); clearTimeout(redirectTimer) }
  }, [username])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #1a1040 0%, #0d1117 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
      padding: '24px',
    }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        {/* Logo */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
          marginBottom: '28px', fontSize: '32px',
          boxShadow: '0 0 60px rgba(124,58,237,0.4)',
          animation: done ? 'none' : 'pulse 2s ease-in-out infinite',
        }}>🔗</div>

        <h2 style={{
          fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #e2d9f3, #93c5fd)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: '8px',
        }}>Building your graph</h2>

        <p style={{ color: '#475569', fontSize: '13px', marginBottom: '40px' }}>
          @{username} · FalkorDB is ingesting your GitHub profile
        </p>

        {/* Steps */}
        <div style={{
          background: 'rgba(22,27,34,0.8)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px',
          padding: '20px 24px', textAlign: 'left',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          {STEPS.map((s, i) => {
            const isActive = i === step && !done
            const isDone = i < step || done
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '9px 0',
                borderBottom: i < STEPS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                opacity: i > step && !done ? 0.3 : 1,
                transition: 'opacity 0.3s',
              }}>
                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>
                  {isDone ? '✅' : isActive ? <Spinner /> : s.icon}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: isActive ? '#c4b5fd' : isDone ? '#94a3b8' : '#475569',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'color 0.3s',
                }}>
                  {s.text}
                </span>
              </div>
            )
          })}
        </div>

        <p style={{ color: '#374151', fontSize: '11px', marginTop: '20px' }}>
          This usually takes 5–10 seconds
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(124,58,237,0.4); }
          50%       { box-shadow: 0 0 80px rgba(124,58,237,0.7); }
        }
      `}</style>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '14px', height: '14px',
      border: '2px solid rgba(124,58,237,0.3)',
      borderTopColor: '#7c3aed', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  )
}
