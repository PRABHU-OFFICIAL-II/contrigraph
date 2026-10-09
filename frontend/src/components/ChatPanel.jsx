import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

function makeComponents() {
  return {
    p: ({ children }) => <p style={{ margin: '0 0 10px', lineHeight: '1.75', color: '#374151', fontFamily: FONT }}>{children}</p>,
    code: ({ inline, children }) =>
      inline ? (
        <code style={{
          background: '#ede9fe', padding: '2px 6px', borderRadius: '4px',
          fontSize: '12px', fontFamily: 'Consolas, monospace', color: '#7c3aed',
        }}>{children}</code>
      ) : (
        <pre style={{
          background: '#f9fafb', padding: '12px 14px', borderRadius: '8px',
          fontSize: '12px', fontFamily: 'Consolas, monospace', overflowX: 'auto',
          margin: '8px 0', border: '1px solid #e5e7eb',
        }}><code style={{ color: '#111827' }}>{children}</code></pre>
      ),
    strong: ({ children }) => <strong style={{ color: '#111827', fontWeight: '700', fontFamily: FONT }}>{children}</strong>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{
        color: '#7c3aed', fontWeight: '600', textDecoration: 'underline',
        textDecorationColor: 'rgba(124,58,237,0.35)', fontFamily: FONT,
        transition: 'text-decoration-color 0.15s',
      }}>{children}</a>
    ),
    ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '6px 0 10px', fontFamily: FONT }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '6px 0 10px', fontFamily: FONT }}>{children}</ol>,
    li: ({ children }) => <li style={{ marginBottom: '4px', lineHeight: '1.75', color: '#374151', fontFamily: FONT }}>{children}</li>,
    h1: ({ children }) => <h1 style={{ fontSize: '15px', fontWeight: '800', color: '#111827', margin: '12px 0 7px', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px', fontFamily: FONT }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#111827', margin: '10px 0 5px', fontFamily: FONT }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#374151', margin: '8px 0 4px', fontFamily: FONT }}>{children}</h3>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />,
    blockquote: ({ children }) => (
      <blockquote style={{
        borderLeft: '3px solid #7c3aed', paddingLeft: '12px', margin: '8px 0',
        color: '#6b7280', fontStyle: 'italic',
      }}>{children}</blockquote>
    ),
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', margin: '10px 0', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead style={{ background: '#ede9fe' }}>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr style={{ borderBottom: '1px solid #f3f4f6' }}>{children}</tr>,
    th: ({ children }) => (
      <th style={{
        padding: '8px 12px', textAlign: 'left', color: '#7c3aed',
        fontWeight: '700', fontSize: '10px', textTransform: 'uppercase',
        letterSpacing: '0.06em', whiteSpace: 'nowrap', fontFamily: FONT,
      }}>{children}</th>
    ),
    td: ({ children }) => (
      <td style={{ padding: '7px 12px', color: '#374151', verticalAlign: 'top', fontSize: '12px', lineHeight: '1.6', fontFamily: FONT }}>{children}</td>
    ),
  }
}

function ToolSummary({ tools }) {
  const [open, setOpen] = useState(false)
  if (!tools?.length) return null
  const unique = [...new Set(tools)]
  const label = unique.length === 1
    ? TOOL_LABELS[unique[0]] || `🔧 ${unique[0]}`
    : `🕸 Graph traversal · ${tools.length} tool calls`

  return (
    <div style={{ marginBottom: '6px', animation: 'fadeIn 0.25s ease both' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: '#ede9fe', border: '1px solid #ddd6fe',
          color: '#7c3aed', borderRadius: '20px', padding: '3px 12px',
          fontSize: '11px', cursor: 'pointer', fontFamily: FONT,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#ddd6fe'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {label}
        <span style={{ fontSize: '9px', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          marginTop: '6px', padding: '8px 12px',
          background: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
          animation: 'fadeInUp 0.2s ease both',
        }}>
          {tools.map((t, i) => (
            <span key={i} style={{ color: '#6b7280', fontSize: '11px', fontFamily: FONT }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f9fafb', fontFamily: FONT }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            animation: 'messageIn 0.3s ease both',
          }}>
            {m.toolCalls?.length > 0 && <ToolSummary tools={m.toolCalls} />}
            {(m.content || m.role === 'user') && (
              <div style={{
                maxWidth: m.role === 'user' ? '72%' : '92%',
                padding: '12px 16px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: m.role === 'user' ? '#7c3aed' : '#ffffff',
                border: m.role === 'user' ? 'none' : '1px solid #e5e7eb',
                color: m.role === 'user' ? '#ffffff' : '#111827',
                fontSize: '13px', lineHeight: '1.7', fontFamily: FONT,
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              }}>
                {m.role === 'assistant'
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={makeComponents()}>{m.content}</ReactMarkdown>
                  : <span style={{ fontFamily: FONT }}>{m.content}</span>
                }
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeInUp 0.2s ease both' }}>
            <div style={{
              display: 'flex', gap: '4px', padding: '11px 16px',
              background: '#ffffff', border: '1px solid #e5e7eb',
              borderRadius: '4px 16px 16px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
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
              <span style={{
                color: '#7c3aed', fontSize: '11px', fontFamily: FONT,
                background: '#ede9fe', padding: '3px 10px',
                borderRadius: '20px', border: '1px solid #ddd6fe',
              }}>
                {TOOL_LABELS[activeTools[activeTools.length - 1]] || 'Thinking…'}
              </span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested queries */}
      {messages.length <= 2 && (
        <div style={{ padding: '0 22px 12px', display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {SUGGESTED.map((s, i) => (
            <button key={i} onClick={() => send(s.text)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#ffffff', border: '1px solid #e5e7eb',
              borderRadius: '20px', color: '#6b7280', padding: '6px 13px',
              fontSize: '11px', cursor: 'pointer', fontFamily: FONT,
              transition: 'all 0.18s ease',
              opacity: 0, animation: `fadeInUp 0.3s ease ${0.05 + i * 0.06}s both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {s.icon} {s.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '14px 22px 16px',
        borderTop: '1px solid #e5e7eb', background: '#ffffff',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask about issues, skills, maintainers…"
            style={{
              flex: 1, padding: '11px 14px',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: '10px', color: '#111827', fontSize: '13px',
              outline: 'none', resize: 'none', lineHeight: '1.6',
              fontFamily: FONT, transition: 'border-color 0.18s, box-shadow 0.18s',
            }}
            onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'; e.target.style.background = '#ffffff' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f9fafb' }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              padding: '11px 20px', borderRadius: '10px', border: 'none',
              background: loading || !input.trim() ? '#e5e7eb' : '#7c3aed',
              color: loading || !input.trim() ? '#9ca3af' : '#ffffff',
              fontWeight: '700', fontSize: '13px', fontFamily: FONT,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.18s ease', flexShrink: 0,
            }}
            onMouseEnter={e => { if (!loading && input.trim()) { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = loading || !input.trim() ? '#e5e7eb' : '#7c3aed'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
        <p style={{ color: '#d1d5db', fontSize: '10px', marginTop: '6px', marginBottom: 0, fontFamily: FONT }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
