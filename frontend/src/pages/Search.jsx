import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ChatPanel from '../components/ChatPanel.jsx'
import SessionHistory from '../components/SessionHistory.jsx'
import GraphPanel from '../components/GraphPanel.jsx'
import ExplorationPanel from '../components/ExplorationPanel.jsx'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'
const SESSION_ID = `session_${Date.now()}`

const LIGHT = {
  bg: '#f9fafb', surface: '#ffffff', surface2: '#fafafa',
  border: '#e5e7eb', border2: '#f3f4f6',
  text: '#111827', textMuted: '#6b7280', textSubtle: '#9ca3af', textFaint: '#d1d5db',
  input: '#f9fafb', hover: '#f3f4f6',
  canvasBg: '#ffffff', edge: 'rgba(0,0,0,0.12)',
  edgeMaint: 'rgba(217,119,6,0.3)', edgeRepo: 'rgba(8,145,178,0.2)',
}
const DARK = {
  bg: '#0f172a', surface: '#1e293b', surface2: '#162032',
  border: '#334155', border2: '#243044',
  text: '#e2e8f0', textMuted: '#94a3b8', textSubtle: '#64748b', textFaint: '#475569',
  input: '#162032', hover: '#243044',
  canvasBg: '#0f172a', edge: 'rgba(148,163,184,0.12)',
  edgeMaint: 'rgba(217,119,6,0.22)', edgeRepo: 'rgba(8,145,178,0.18)',
}

const SKILLS = ['python', 'javascript', 'typescript', 'java', 'go', 'dart', 'html']
const SKILL_COLORS = {
  python: '#3b82f6', javascript: '#f59e0b', typescript: '#06b6d4',
  java: '#ef4444', go: '#22d3ee', dart: '#a78bfa', html: '#fb923c',
}

function MiniGraphSVG() {
  const cx = 90, cy = 72
  const repos = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * 2 * Math.PI - Math.PI / 2
    return { x: cx + Math.cos(a) * 44, y: cy + Math.sin(a) * 38 }
  })
  const skills = [
    { x: 20, y: 20 }, { x: 160, y: 20 }, { x: 20, y: 124 },
    { x: 160, y: 124 }, { x: 90, y: 10 }, { x: 10, y: 72 }, { x: 170, y: 72 },
  ]
  return (
    <svg width="180" height="144" viewBox="0 0 180 144" style={{ display: 'block' }}>
      {skills.map((s, i) => (
        <line key={`se${i}`} x1={cx} y1={cy} x2={s.x} y2={s.y}
          stroke="rgba(124,58,237,0.15)" strokeWidth="1" />
      ))}
      {repos.map((r, i) => (
        <line key={`re${i}`} x1={cx} y1={cy} x2={r.x} y2={r.y}
          stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
      ))}
      {repos.map((r, i) => (
        <circle key={`rn${i}`} cx={r.x} cy={r.y} r="5"
          fill="#f0883e" opacity="0.85"
          style={{ animation: `nodeFloat 3s ease-in-out ${i * 0.3}s infinite` }} />
      ))}
      {skills.map((s, i) => (
        <circle key={`sn${i}`} cx={s.x} cy={s.y} r="4"
          fill="#3b82f6" opacity="0.9"
          style={{ animation: `nodeFloat 2.5s ease-in-out ${i * 0.25}s infinite` }} />
      ))}
      <circle cx={cx} cy={cy} r="10" fill="#7c3aed" />
      <circle cx={cx} cy={cy} r="10" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
    </svg>
  )
}

export default function Search() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('contrigraph-theme') === 'dark')
  const T = darkMode ? DARK : LIGHT
  const [showModal, setShowModal] = useState(false)
  const [historyTick, setHistoryTick] = useState(0)
  const [graphTick, setGraphTick] = useState(0)
  const [graphMeta, setGraphMeta] = useState({ nodes: 0, edges: 0 })

  function toggleTheme() {
    setDarkMode(d => { localStorage.setItem('contrigraph-theme', d ? 'light' : 'dark'); return !d })
  }

  useEffect(() => {
    if (!username) return
    fetch(`/api/graph/data?username=${username}`)
      .then(r => r.json())
      .then(d => setGraphMeta({ nodes: d.nodes?.length || 0, edges: d.links?.length || 0 }))
      .catch(() => {})
  }, [username, graphTick])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: FONT }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: '220px', minWidth: '220px',
        background: T.surface, borderRight: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideInLeft 0.35s ease both',
      }}>

        {/* Brand */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
              background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
            }}>🔗</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.text, fontWeight: '800', fontSize: '13px', fontFamily: FONT }}>ContriGraph</div>
              <div style={{ color: '#7c3aed', fontSize: '11px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>@{username}</div>
            </div>
          </div>
        </div>

        {/* Knowledge Graph preview card */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border2}` }}>
          <div style={{ color: T.textSubtle, fontSize: '10px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px', fontFamily: FONT }}>
            Knowledge Graph
          </div>
          <div
            onClick={() => setShowModal(true)}
            style={{
              borderRadius: '10px', border: `1px solid ${T.border}`,
              background: T.surface2, overflow: 'hidden', cursor: 'pointer',
              transition: 'all 0.2s ease',
              animation: 'fadeInUp 0.4s ease 0.1s both',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.12)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <MiniGraphSVG />
            <div style={{
              padding: '7px 10px', background: T.surface,
              borderTop: `1px solid ${T.border2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: T.textMuted, fontFamily: FONT }}>
                  <strong style={{ color: T.text }}>{graphMeta.nodes}</strong> nodes
                </span>
                <span style={{ fontSize: '10px', color: T.textMuted, fontFamily: FONT }}>
                  <strong style={{ color: T.text }}>{graphMeta.edges}</strong> edges
                </span>
              </div>
              <span style={{
                fontSize: '9px', color: '#7c3aed', fontWeight: '700',
                fontFamily: FONT, letterSpacing: '0.04em',
              }}>EXPAND ↗</span>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border2}` }}>
          <div style={{ color: T.textSubtle, fontSize: '10px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '9px', fontFamily: FONT }}>Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {SKILLS.map((s, i) => (
              <span key={s} style={{
                padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '600',
                background: (SKILL_COLORS[s] || '#7c3aed') + '18',
                color: SKILL_COLORS[s] || '#7c3aed',
                border: `1px solid ${(SKILL_COLORS[s] || '#7c3aed')}30`,
                fontFamily: FONT,
                opacity: 0, animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
              }}>{s}</span>
            ))}
          </div>
        </div>

        {/* History */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px 8px', color: T.textSubtle, fontSize: '10px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: FONT }}>History</div>
          <SessionHistory username={username} refreshTick={historyTick} darkMode={darkMode} />
        </div>

        {/* Logout */}
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border2}`, flexShrink: 0 }}>
          <button
            onClick={() => { try { localStorage.removeItem(`contrigraph-chat-${username}`) } catch {} navigate('/') }}
            style={{
              width: '100%', padding: '8px', borderRadius: '7px', fontSize: '11px',
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.textSubtle, cursor: 'pointer', fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSubtle; e.currentTarget.style.background = 'transparent' }}
          >⏏ Log out</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          padding: '0 24px', height: '52px', flexShrink: 0,
          borderBottom: `1px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'fadeIn 0.35s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: T.text, fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Find Open Source Issues</span>
            <span style={{
              background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe',
              borderRadius: '20px', padding: '2px 9px', fontSize: '10px', fontWeight: '700',
              fontFamily: FONT, letterSpacing: '0.04em',
            }}>AI AGENT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: T.textFaint, fontFamily: FONT }}>Live Exploration →</span>
            <button
              onClick={toggleTheme}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: darkMode ? '#334155' : '#f3f4f6',
                border: `1px solid ${T.border}`,
                borderRadius: '8px', width: '32px', height: '28px',
                cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s ease',
              }}
            >{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>

        {/* Chat + Exploration side by side */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <ChatPanel
              username={username}
              sessionId={SESSION_ID}
              onToolCall={() => {}}
              onAgentDone={() => { setHistoryTick(t => t + 1); setGraphTick(t => t + 1) }}
              darkMode={darkMode}
            />
          </div>
          <ExplorationPanel username={username} refreshTick={graphTick} darkMode={darkMode} />
        </div>
      </main>

      {/* ── Full-screen graph modal overlay ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease both',
          padding: '24px',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            width: '100%', maxWidth: '1200px', height: '90vh',
            background: T.surface, borderRadius: '16px',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
            animation: 'modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
            position: 'relative',
          }}>

            {/* Modal header */}
            <div style={{
              padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0, background: T.surface,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: '#7c3aed', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '13px',
                }}>🕸</div>
                <span style={{ fontWeight: '800', fontSize: '14px', color: T.text, fontFamily: FONT }}>
                  Knowledge Graph
                </span>
                <span style={{
                  fontSize: '10px', color: '#7c3aed', fontWeight: '700',
                  background: '#ede9fe', border: '1px solid #ddd6fe',
                  padding: '2px 8px', borderRadius: '20px', fontFamily: FONT,
                }}>FalkorDB</span>
                <span style={{ fontSize: '11px', color: T.textMuted, fontFamily: FONT }}>
                  {graphMeta.nodes} nodes · {graphMeta.edges} edges
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: T.hover, border: 'none', borderRadius: '8px',
                  width: '32px', height: '32px', fontSize: '16px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: T.textMuted,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = T.hover; e.currentTarget.style.color = T.textMuted }}
              >✕</button>
            </div>

            {/* Graph canvas */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <GraphPanel username={username} visible={true} refreshTick={graphTick} hideHeader={true} darkMode={darkMode} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes nodeFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-3px); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
