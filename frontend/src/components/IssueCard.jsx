const complexityColor = { beginner: '#3fb950', intermediate: '#d29922', advanced: '#f85149' }

const styles = {
  card: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '12px',
    transition: 'border-color 0.2s',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  title: { color: '#e6edf3', fontWeight: '600', fontSize: '14px', flex: 1 },
  badge: (color) => ({
    background: color + '22',
    color,
    border: `1px solid ${color}44`,
    borderRadius: '12px',
    padding: '2px 10px',
    fontSize: '11px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  }),
  meta: { display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' },
  metaItem: { color: '#8b949e', fontSize: '12px' },
  friends: { marginTop: '8px', color: '#58a6ff', fontSize: '12px' },
  actions: { display: 'flex', gap: '8px', marginTop: '12px' },
  btn: (variant) => ({
    padding: '5px 14px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500',
    background: 'transparent',
    borderColor: variant === 'primary' ? '#238636' : '#30363d',
    color: variant === 'primary' ? '#3fb950' : '#8b949e',
  }),
}

export default function IssueCard({ issue, onAction }) {
  const {
    title, url, complexity, repo, stars, maintainer,
    response_days, friend_contributors, friend_names, issue_id,
  } = issue

  const color = complexityColor[complexity] || '#8b949e'

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        <span style={styles.badge(color)}>{complexity || 'unknown'}</span>
      </div>

      <div style={styles.meta}>
        <span style={styles.metaItem}>📦 {repo}</span>
        <span style={styles.metaItem}>⭐ {(stars || 0).toLocaleString()}</span>
        {maintainer && <span style={styles.metaItem}>👤 @{maintainer}</span>}
        {response_days != null && <span style={styles.metaItem}>⚡ {response_days}d avg response</span>}
      </div>

      {friend_contributors > 0 && (
        <div style={styles.friends}>
          🤝 {friend_contributors} connection{friend_contributors > 1 ? 's' : ''} contributed here
          {friend_names?.length > 0 && ` (${friend_names.slice(0, 3).join(', ')})`}
        </div>
      )}

      <div style={styles.actions}>
        <a href={url} target="_blank" rel="noreferrer">
          <button style={styles.btn('primary')}>View Issue →</button>
        </a>
        <button style={styles.btn()} onClick={() => onAction?.('bookmarked', issue_id)}>Bookmark</button>
        <button style={styles.btn()} onClick={() => onAction?.('skipped', issue_id)}>Skip</button>
      </div>
    </div>
  )
}
