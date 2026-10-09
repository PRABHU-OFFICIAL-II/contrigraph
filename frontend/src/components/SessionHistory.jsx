import { useEffect, useState } from 'react'
import { getSessionHistory } from '../utils/api.js'

const FONT = 'Verdana, Geneva, Tahoma, sans-serif'

const ACTION_STYLES = {
  viewed:     { icon: '👁', color: '#6b7280' },
  bookmarked: { icon: '🔖', color: '#d97706' },
  skipped:    { icon: '⏭', color: '#9ca3af' },
  applied:    { icon: '✅', color: '#16a34a' },
  applied_to: { icon: '✅', color: '#16a34a' },
}

export default function SessionHistory({ username, refreshTick }) {
  const [history, setHistory] = useState([])

  function load() {
    if (!username) return
    getSessionHistory(username, 7).then(data => setHistory(Array.isArray(data) ? data : []))
  }

  useEffect(() => { load() }, [username, refreshTick])

  useEffect(() => {
    if (!username) return
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [username])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 14px' }}>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', animation: 'fadeIn 0.3s ease both' }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>🌱</div>
          <p style={{ color: '#d1d5db', fontSize: '11px', lineHeight: '1.5', fontFamily: FONT }}>
            No history yet.<br />Start exploring issues!
          </p>
        </div>
      ) : (
        history.map((item, i) => {
          const s = ACTION_STYLES[item.action] || ACTION_STYLES.viewed
          return (
            <div
              key={i}
              style={{
                padding: '7px 8px', borderRadius: '7px', marginBottom: '2px',
                display: 'flex', gap: '8px', alignItems: 'flex-start',
                transition: 'background 0.15s',
                opacity: 0,
                animation: `fadeInUp 0.3s ease ${Math.min(i * 0.04, 0.25)}s both`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>{s.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  color: '#374151', fontSize: '11px', lineHeight: '1.4',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: FONT, fontWeight: '500',
                }}>{item.title || 'Untitled issue'}</div>
                <div style={{
                  color: '#9ca3af', fontSize: '10px', marginTop: '2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: FONT,
                }}>{item.repo || ''}</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
