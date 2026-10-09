import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamChat, recordAction } from '../utils/api.js'

const SUGGESTED = [
  { icon: '🔍', text: 'Find me beginner Python issues with active maintainers' },
  { icon: '🎯', text: 'What open source issues match my skills?' },
  { icon: '📚', text: 'Show me my exploration history from this week' },
  { icon: '📦', text: 'Ingest issues from tiangolo/fastapi' },
]

const TOOL_LABELS = {
  find_matching_issues: '🔍 Querying issues graph…',
  ingest_developer: '⬇️ Fetching GitHub profile…',
  analyse_skill_gaps: '📊 Analysing skill gaps…',
  find_connection_path: '🕸 Tracing connection path…',
  find_related_repos: '🔗 Finding related repos…',
  get_repo_health: '💊 Checking repo health…',
  remember_action: '💾 Saving to memory…',
  get_session_history: '🕐 Loading session history…',
  ingest_repo_issues: '📥 Ingesting repo issues…',
}

export default function ChatPanel({ username, sessionId, onToolCall }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Hi! I'm **ContriGraph**. I've loaded your GitHub graph — you know **Python, JavaScript, TypeScript, Java, Go, Dart, and HTML**.\n\nWhat kind of open source issue are you looking for today?`,
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTools, setActiveTools] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setActiveTools([])

    setMessages(prev => [...prev,
      { role: 'user', content: msg },
      { role: 'assistant', content: '', toolCalls: [] },
    ])
    setLoading(true)

    const history = messages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content }))

    await streamChat({
      username, message: msg, sessionId, history,
      onChunk: chunk => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      },
      onToolCall: (tool, inp) => {
        onToolCall?.(tool, inp)
        setActiveTools(prev => [...prev, tool])
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, toolCalls: [...(last.toolCalls || []), tool] }
          return updated
        })
      },
      onDone: () => { setLoading(false); setActiveTools([]) },
    })
    setLoading(false)
    setActiveTools([])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '6px' }}>
            {/* Tool call badges */}
            {m.toolCalls?.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {m.toolCalls.map((t, j) => (
                  <span key={j} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                    color: '#a78bfa', borderRadius: '20px', padding: '3px 10px', fontSize: '11px',
                  }}>
                    {TOOL_LABELS[t] || `🔧 ${t}`}
                  </span>
                ))}
              </div>
            )}

            {/* Bubble */}
            <div style={{
              maxWidth: m.role === 'user' ? '72%' : '88%',
              padding: '12px 16px',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
              background: m.role === 'user'
                ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                : 'rgba(30,41,59,0.8)',
              border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
              color: '#e2e8f0', fontSize: '14px', lineHeight: '1.7',
              boxShadow: m.role === 'user' ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
            }}>
              {m.role === 'assistant'
                ? <ReactMarkdown components={{
                    p: ({children}) => <p style={{ margin: '0 0 8px', lastChild: { margin: 0 } }}>{children}</p>,
                    code: ({children}) => <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{children}</code>,
                    strong: ({children}) => <strong style={{ color: '#c4b5fd' }}>{children}</strong>,
                    li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                  }}>{m.content || (loading && i === messages.length - 1 ? ' ' : '')}</ReactMarkdown>
                : m.content
              }
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '12px 16px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px 18px 18px 18px' }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed',
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                  display: 'inline-block',
                }} />
              ))}
            </div>
            {activeTools.length > 0 && (
              <span style={{ color: '#64748b', fontSize: '12px' }}>
                {TOOL_LABELS[activeTools[activeTools.length - 1]] || 'Thinking…'}
              </span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested queries — show only at start */}
      {messages.length <= 2 && (
        <div style={{ padding: '0 28px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SUGGESTED.map((s, i) => (
            <button key={i} onClick={() => send(s.text)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '20px', color: '#94a3b8', padding: '7px 14px',
              fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = '#c4b5fd' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94a3b8' }}
            >
              {s.icon} {s.text}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '16px 28px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(15,20,30,0.8)',
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask about issues, skills, maintainers…"
            style={{
              flex: 1, padding: '12px 16px',
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', color: '#e2e8f0', fontSize: '14px',
              outline: 'none', resize: 'none', lineHeight: '1.5',
              fontFamily: 'inherit', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 20px', borderRadius: '12px', border: 'none',
              background: loading || !input.trim() ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#fff', fontWeight: '600', fontSize: '14px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
        <p style={{ color: '#374151', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
