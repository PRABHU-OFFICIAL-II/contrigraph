import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ChatPanel from '../components/ChatPanel.jsx'
import SessionHistory from '../components/SessionHistory.jsx'
import GraphPanel from '../components/GraphPanel.jsx'

const SESSION_ID = `session_${Date.now()}`
const SKILLS = ['python', 'javascript', 'typescript', 'java', 'go', 'dart', 'html']

const SKILL_COLORS = {
  python: '#3b82f6', javascript: '#f59e0b', typescript: '#06b6d4',
  java: '#ef4444', go: '#22d3ee', dart: '#a78bfa', html: '#fb923c',
}

export default function Search() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [showGraph, setShowGraph] = useState(true)
  const [highlightIds, setHighlightIds] = useState([])
  const [historyTick, setHistoryTick] = useState(0)

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#0d1117', fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: '220px', minWidth: '220px',
        background: '#0a0f1a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
            }}>🔗</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '14px', letterSpacing: '-0.01em' }}>ContriGraph</div>
              <div style={{ color: '#7c3aed', fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{username}</div>
            </div>
          </div>
          {/* Logout */}
          <button
            onClick={() => {
              try { localStorage.removeItem(`contrigraph-chat-${username}`) } catch {}
              navigate('/')
            }}
            style={{
              width: '100%', padding: '6px', borderRadius: '7px', fontSize: '11px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748b', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#64748b' }}
          >
            ⏏ Log out
          </button>
        </div>

        {/* Skills */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: '#475569', fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Skills
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SKILLS.map(s => (
              <span key={s} style={{
                padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
                background: (SKILL_COLORS[s] || '#7c3aed') + '18',
                color: SKILL_COLORS[s] || '#a78bfa',
                border: `1px solid ${(SKILL_COLORS[s] || '#7c3aed')}30`,
              }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Graph stats */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: '#475569', fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Graph
          </div>
          {[
            { label: 'Repositories', value: '40', color: '#f0883e' },
            { label: 'Skills', value: '7', color: '#58a6ff' },
            { label: 'Connections', value: '80', color: '#a78bfa' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <span style={{ color: '#64748b', fontSize: '12px' }}>{stat.label}</span>
              <span style={{ color: stat.color, fontWeight: '700', fontSize: '12px' }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Session History */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px 8px', color: '#475569', fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            History
          </div>
          <SessionHistory username={username} refreshTick={historyTick} />
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          padding: '0 24px', height: '52px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,15,26,0.8)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>Find Open Source Issues</span>
            <span style={{
              background: 'rgba(124,58,237,0.15)', color: '#a78bfa',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: '20px', padding: '1px 10px', fontSize: '11px', fontWeight: '600',
            }}>AI Agent</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowGraph(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                background: showGraph ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: showGraph ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: showGraph ? '#a78bfa' : '#64748b',
              }}
            >
              <span>🕸</span> {showGraph ? 'Graph On' : 'Graph Off'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: showGraph ? '0 0 55%' : '1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatPanel username={username} sessionId={SESSION_ID} onToolCall={() => {}} onAgentDone={() => setHistoryTick(t => t + 1)} />
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', display: showGraph ? 'block' : 'none' }}>
            <GraphPanel username={username} highlightIds={highlightIds} visible={showGraph} />
          </div>
        </div>
      </main>
    </div>
  )
}
