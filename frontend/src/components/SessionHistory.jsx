import { useEffect, useState } from 'react'
import { getSessionHistory } from '../utils/api.js'

const ACTION_STYLES = {
  viewed:     { icon: '👁', color: '#64748b' },
  bookmarked: { icon: '🔖', color: '#f59e0b' },
  skipped:    { icon: '⏭', color: '#475569' },
  applied:    { icon: '✅', color: '#22c55e' },
  applied_to: { icon: '✅', color: '#22c55e' },
}

export default function SessionHistory({ username, refreshTick }) {
  const [history, setHistory] = useState([])

  function load() {
    if (!username) return
    getSessionHistory(username, 7).then(data => setHistory(Array.isArray(data) ? data : []))
  }

  // Load on mount and whenever refreshTick changes (triggered by parent after agent responds)
  useEffect(() => { load() }, [username, refreshTick])

  // Also poll every 10 seconds so new VIEWED records surface automatically
  useEffect(() => {
    if (!username) return
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [username])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 16px' }}>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>🌱</div>
          <p style={{ color: '#374151', fontSize: '11px', lineHeight: '1.5' }}>
            No history yet.<br />Start exploring issues!
          </p>
        </div>
      ) : (
        history.map((item, i) => {
          const s = ACTION_STYLES[item.action] || ACTION_STYLES.viewed
          return (
            <div key={i} style={{
              padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>{s.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: '#94a3b8', fontSize: '11px', lineHeight: '1.4',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{item.title}</div>
                <div style={{ color: '#374151', fontSize: '10px', marginTop: '2px' }}>{item.repo}</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
