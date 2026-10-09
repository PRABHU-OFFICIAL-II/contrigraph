const BASE = '/api'

export async function ingestDeveloper(username) {
  const res = await fetch(`${BASE}/developer/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_username: username }),
  })
  return res.json()
}

export async function getDeveloper(username) {
  const res = await fetch(`${BASE}/developer/${username}`)
  if (!res.ok) return null
  return res.json()
}

export async function searchIssues(username, opts = {}) {
  const params = new URLSearchParams({ username, ...opts })
  const res = await fetch(`${BASE}/search/issues?${params}`)
  return res.json()
}

export async function getSessionHistory(username, daysBack = 7) {
  const res = await fetch(`${BASE}/session/${username}?days_back=${daysBack}`)
  return res.json()
}

export async function recordAction(username, payload) {
  await fetch(`${BASE}/session/${username}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function getRepoHealth(repo) {
  const res = await fetch(`${BASE}/search/repo-health?repo=${encodeURIComponent(repo)}`)
  return res.json()
}

export async function getSkillGaps(username, repo) {
  const res = await fetch(`${BASE}/search/skill-gaps?username=${username}&repo=${encodeURIComponent(repo)}`)
  return res.json()
}

/**
 * Stream a chat message. Calls onChunk(text) for each text delta,
 * onToolCall(name, input) when the agent calls a tool, and onDone() at end.
 */
export async function streamChat({ username, message, sessionId, history, onChunk, onToolCall, onDone }) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      message,
      session_id: sessionId,
      history,
    }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'text') onChunk?.(event.content)
        else if (event.type === 'tool_call') onToolCall?.(event.tool, event.input)
        else if (event.type === 'done') onDone?.()
      } catch {}
    }
  }
}
