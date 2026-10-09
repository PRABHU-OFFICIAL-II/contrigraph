import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

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
    const stepTimer = setInterval(() => {
      setStep(prev => {
        if (prev >= STEPS.length - 1) { clearInterval(stepTimer); return prev }
        return prev + 1
      })
    }, 900)
    const redirectTimer = setTimeout(() => {
      setDone(true)
      setTimeout(() => navigate(`/search/${username}`), 400)
    }, STEPS.length * 900 + 200)
    return () => { clearInterval(stepTimer); clearTimeout(redirectTimer) }
  }, [username])

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, padding: '24px',
    }}>
      <div style={{
        textAlign: 'center', maxWidth: '380px', width: '100%',
        animation: 'fadeInUp 0.4s ease both',
      }}>
        {/* Logo */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '60px', height: '60px', borderRadius: '16px',
          background: '#7c3aed', fontSize: '26px', marginBottom: '20px',
        }}>🔗</div>

        <h2 style={{
          fontSize: '20px', fontWeight: '800', color: '#111827',
          letterSpacing: '-0.02em', marginBottom: '6px', fontFamily: FONT,
        }}>Building your graph</h2>

        <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '28px', fontFamily: FONT }}>
          @{username} · FalkorDB is ingesting your GitHub profile
        </p>

        {/* Progress bar */}
        <div style={{
          height: '4px', background: '#e5e7eb',
          borderRadius: '99px', marginBottom: '20px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', background: '#7c3aed', borderRadius: '99px',
            width: `${progress}%`,
            transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>

        {/* Steps card */}
        <div style={{
          background: '#ffffff', border: '1px solid #e5e7eb',
          borderRadius: '12px', padding: '18px 22px', textAlign: 'left',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          {STEPS.map((s, i) => {
            const isActive = i === step && !done
            const isDone = i < step || done
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 0',
                borderBottom: i < STEPS.length - 1 ? '1px solid #f3f4f6' : 'none',
                opacity: i > step && !done ? 0.3 : 1,
                transition: 'opacity 0.35s ease',
                animation: isDone || isActive ? 'stepIn 0.3s ease both' : 'none',
              }}>
                <span style={{
                  fontSize: '14px', width: '20px', textAlign: 'center', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isDone ? '✅' : isActive ? <StepSpinner /> : s.icon}
                </span>
                <span style={{
                  fontSize: '12px', fontFamily: FONT,
                  color: isActive ? '#7c3aed' : isDone ? '#9ca3af' : '#6b7280',
                  fontWeight: isActive ? '700' : '400',
                  transition: 'color 0.3s',
                }}>{s.text}</span>
              </div>
            )
          })}
        </div>

        <p style={{ color: '#9ca3af', fontSize: '11px', marginTop: '14px', fontFamily: FONT }}>
          This usually takes 5–10 seconds
        </p>
      </div>
    </div>
  )
}

function StepSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: '13px', height: '13px',
      border: '2px solid rgba(124,58,237,0.2)',
      borderTopColor: '#7c3aed', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
