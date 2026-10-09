import { useParams, useNavigate } from 'react-router-dom'

export default function Profile() {
  const { username } = useParams()
  const navigate = useNavigate()
  return (
    <div style={{ padding: '40px', color: '#e6edf3' }}>
      <h2>Profile: @{username}</h2>
      <p style={{ color: '#8b949e', marginTop: '8px' }}>Graph stats coming on Day 3.</p>
      <button
        onClick={() => navigate(`/search/${username}`)}
        style={{ marginTop: '20px', padding: '8px 16px', background: '#238636', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
      >
        ← Back to Search
      </button>
    </div>
  )
}
