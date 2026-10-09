import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamChat } from '../utils/api.js'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

const SUGGESTED = [
  { icon: '🔍', text: 'Find me beginner Python issues with active maintainers' },
  { icon: '🎯', text: 'What open source issues match my skills?' },
  { icon: '📚', text: 'Show my exploration history from this week' },
  { icon: '📦', text: 'Ingest issues from tiangolo/fastapi' },
]

const TOOL_LABELS = {
  find_matching_issues:  '🔍 Queried issues graph',
  ingest_developer:      '⬇️ Fetched GitHub profile',
  analyse_skill_gaps:    '📊 Analysed skill gaps',
  find_connection_path:  '🕸 Traced connection path',
  find_related_repos:    '🔗 Found related repos',
  get_repo_health:       '💊 Checked repo health',
  remember_action:       '💾 Saved to memory',
  get_session_history:   '🕐 Loaded session history',
  ingest_repo_issues:    '📥 Ingested repo issues',
}

/* Markdown component overrides for better readability */
function makeComponents(isUser) {
  return {
    p: ({ children }) => (
      <p style={{ margin: '0 0 10px', lineHeight: '1.75' }}>{children}</p>
    ),
    code: ({ inline, children }) =>
      inline ? (
        <code style={{
          background: 'rgba(0,0,0,0.35)', padding: '2px 7px', borderRadius: '4px',
          fontSize: '12px', fontFamily: 'Consolas, monospace', color: '#c4b5fd',
        }}>{children}</code>
      ) : (
        <pre style={{
          background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '8px',
          fontSize: '12px', fontFamily: 'Consolas, monospace', overflowX: 'auto',
          margin: '8px 0', border: '1px solid rgba(255,255,255,0.07)',
        }}><code>{children}</code></pre>
      ),
    strong: ({ children }) => (
      <strong style={{ color: isUser ? '#e2d9f3' : '#c4b5fd', fontWeight: '700' }}>{children}</strong>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{
        color: '#60a5fa', textDecoration: 'underline', textDecorationColor: 'rgba(96,165,250,0.4)',
        wordBreak: 'break-all',
      }}>{children}</a>
    ),
    ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '6px 0 10px' }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '6px 0 10px' }}>{children}</ol>,
    li: ({ children }) => <li style={{ marginBottom: '5px', lineHeight: '1.7' }}>{children}</li>,
    h1: ({ children }) => <h1 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0', margin: '12px 0 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#c4b5fd', margin: '12px 0 6px' }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', margin: '10px 0 5px' }}>{children}</h3>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />,
    blockquote: ({ children }) => (
      <blockquote style={{
        borderLeft: '3px solid #7c3aed', paddingLeft: '12px', margin: '8px 0',
        color: '#94a3b8', fontStyle: 'italic',
      }}>{children}</blockquote>
    ),
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead style={{ background: 'rgba(124,58,237,0.15)' }}>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{children}</tr>,
    th: ({ children }) => (
      <th style={{
        padding: '8px 12px', textAlign: 'left', color: '#c4b5fd',
        fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '0.05em', whiteSpace: 'nowrap',
      }}>{children}</th>
    ),
    td: ({ children }) => (
      <td style={{
        padding: '7px 12px', color: '#e2e8f0', verticalAlign: 'top',
        fontSize: '12px', lineHeight: '1.6',
      }}>{children}</td>
    ),
  }
}

/* Collapsible tool-call summary shown above a message */
function ToolSummary({ tools }) {
  const [open, setOpen] = useState(false)
  if (!tools?.length) return null
  const unique = [...new Set(tools)]
  const label = unique.length === 1
    ? TOOL_LABELS[unique[0]] || `🔧 ${unique[0]}`
    : `🕸 Graph traversal · ${tools.length} tool calls`

  return (
    <div style={{ marginBottom: '6px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)',
          color: '#a78bfa', borderRadius: '20px', padding: '3px 12px',
          fontSize: '11px', cursor: 'pointer', fontFamily: FONT,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
      >
        {label}
        <span style={{ fontSize: '9px', opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          marginTop: '6px', padding: '8px 12px',
          background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {tools.map((t, i) => (
            <span key={i} style={{ color: '#64748b', fontSize: '11px' }}>
              {TOOL_LABELS[t] || `🔧 ${t}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const WELCOME = {
  role: 'assistant',
  content: `Hi! I'm **ContriGraph**. I've loaded your GitHub graph — you know **Python, JavaScript, TypeScript, Java, Go, Dart, and HTML**.\n\nWhat kind of open source issue are you looking for today?`,
}

export default function ChatPanel({ username, sessionId, onToolCall, onAgentDone }) {
  const storageKey = `contrigraph-chat-${username}`

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch {}
    return [WELCOME]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTools, setActiveTools] = useState([])
  const bottomRef = useRef(null)

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)) } catch {}
  }, [messages])

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
      onDone: () => { setLoading(false); setActiveTools([]); onAgentDone?.() },
    })
    setLoading(false)
    setActiveTools([])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117', fontFamily: FONT }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>

            {/* Tool summary — collapsed by default */}
            {m.toolCalls?.length > 0 && <ToolSummary tools={m.toolCalls} />}

            {/* Bubble — skip when assistant content is still empty (typing indicator shown instead) */}
            {(m.content || m.role === 'user') && (
              <div style={{
                maxWidth: m.role === 'user' ? '70%' : '90%',
                padding: '14px 18px',
                borderRadius: m.role === 'user' ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
                background: m.role === 'user'
                  ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                  : 'rgba(22,30,45,0.9)',
                border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)',
                color: '#e2e8f0',
                fontSize: '13px',
                lineHeight: '1.7',
                boxShadow: m.role === 'user'
                  ? '0 4px 20px rgba(124,58,237,0.25)'
                  : '0 2px 12px rgba(0,0,0,0.2)',
                letterSpacing: '0.01em',
              }}>
                {m.role === 'assistant'
                  ? <ReactMarkdown components={makeComponents(false)}>{m.content}</ReactMarkdown>
                  : <span>{m.content}</span>
                }
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex', gap: '5px', padding: '12px 18px',
              background: 'rgba(22,30,45,0.9)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '5px 18px 18px 18px',
            }}>
              {[0, 1, 2].map(j => (
                <span key={j} style={{
                  width: '7px', height: '7px', borderRadius: '50%', background: '#7c3aed',
                  display: 'inline-block',
                  animation: 'bounce 1.2s ease-in-out infinite',
                  animationDelay: `${j * 0.18}s`,
                }} />
              ))}
            </div>
            {activeTools.length > 0 && (
              <span style={{ color: '#475569', fontSize: '12px', fontStyle: 'italic' }}>
                {TOOL_LABELS[activeTools[activeTools.length - 1]] || 'Thinking…'}
              </span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested queries */}
      {messages.length <= 2 && (
        <div style={{ padding: '0 24px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SUGGESTED.map((s, i) => (
            <button key={i} onClick={() => send(s.text)} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(22,30,45,0.7)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '20px', color: '#94a3b8', padding: '7px 15px',
              fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: FONT,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = '#c4b5fd' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94a3b8' }}
            >
              {s.icon} {s.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '14px 24px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,15,26,0.9)',
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
              background: 'rgba(22,30,45,0.8)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', color: '#e2e8f0', fontSize: '13px',
              outline: 'none', resize: 'none', lineHeight: '1.6',
              fontFamily: FONT, transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 22px', borderRadius: '12px', border: 'none',
              background: loading || !input.trim() ? 'rgba(124,58,237,0.25)' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#fff', fontWeight: '700', fontSize: '13px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s', fontFamily: FONT, flexShrink: 0,
              letterSpacing: '0.03em',
            }}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
        <p style={{ color: '#2d3748', fontSize: '11px', marginTop: '7px', marginBottom: 0 }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
