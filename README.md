# ContriGraph

**Find your path in open source. One graph at a time.**

ContriGraph is an AI agent that uses a FalkorDB knowledge graph to match developers with open source issues perfectly suited to their skills — and remembers every interaction to get smarter over time.

---

## The Core Idea

Most "find issues" tools do keyword search. ContriGraph does **graph traversal**.

When you ask "show me TypeScript issues with responsive maintainers", ContriGraph executes a 4-hop Cypher query across FalkorDB:

```
Developer -[:HAS_SKILL]-> Skill <-[:NEEDS_SKILL]- Issue
    <-[:HAS_ISSUE]- Repository -[:MAINTAINED_BY]-> Maintainer
```

It ranks results by:
- Social proximity (friends who've contributed → repo gets a boost)
- Maintainer responsiveness (`avg_response_days`)
- Issue complexity matching your level
- Whether you've already skipped or applied to the issue (graph memory)

---

## Graph Schema

```
(Developer)-[:HAS_SKILL]->(Skill)
(Developer)-[:CONTRIBUTED_TO]->(Repository)
(Developer)-[:FOLLOWS]->(Developer)
(Developer)-[:VIEWED|BOOKMARKED|SKIPPED|APPLIED_TO]->(Issue)

(Repository)-[:HAS_ISSUE]->(Issue)
(Repository)-[:MAINTAINED_BY]->(Maintainer)
(Repository)-[:REQUIRES_SKILL]->(Skill)

(Issue)-[:NEEDS_SKILL]->(Skill)
```

Every `VIEWED`, `BOOKMARKED`, `SKIPPED`, and `APPLIED_TO` relationship is written back to FalkorDB with a timestamp and session ID — this is the **agent memory** layer.

---

## Architecture

```
Browser (React + Vite)
    │  SSE stream
    ▼
FastAPI Backend (Python)
    │
    ├── Agent loop (Claude via Anthropic API)
    │       └── Tool calls → mcp_server.py dispatcher
    │
    ├── FalkorDB (graph store — multi-hop Cypher)
    │
    └── GitHub API (developer ingestion + dynamic repo search)
```

The agent loop is a standard `tool_use` → `tool_result` cycle. The agent calls `find_matching_issues` which:

1. Runs the multi-hop Cypher query
2. If empty: searches GitHub for repos matching the requested language, ingests their issues, ensures the developer has the skill, retries
3. Writes `VIEWED` edges to FalkorDB for every returned issue

---

## Features

- **Multi-hop graph matching** — Developer → Skill → Issue → Repo → Maintainer chain
- **Social graph boost** — Issues in repos where your GitHub follows have contributed rank higher
- **Agent memory** — Bookmark, skip, or mark applied — all stored as graph edges
- **Dynamic ingestion** — Unknown skill? GitHub Search finds the right repos automatically
- **Live exploration graph** — Canvas visualization of the growing knowledge graph
- **Session history** — Every issue viewed, bookmarked, or applied to, persisted in FalkorDB
- **Skill gap analysis** — "What skills does microsoft/vscode need that I don't have?"
- **Dark / light mode**

---

## Quick Start

### Prerequisites

- Docker Desktop (for FalkorDB)
- Python 3.11+
- Node.js 18+
- GitHub Personal Access Token
- Anthropic API key (or compatible endpoint)

### 1. Start FalkorDB

```bash
docker run -d --name falkordb -p 6379:6379 falkordb/falkordb:latest
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in GITHUB_TOKEN, ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Ingest your GitHub profile

```bash
curl -X POST http://localhost:8001/api/developer/ingest \
  -H 'Content-Type: application/json' \
  -d '{"github_username": "YOUR_USERNAME"}'
```

Then open the app, type your username, and start exploring.

---

## Example Queries

| Query | What happens in the graph |
|---|---|
| "show me Go issues" | `find_matching_issues(skill='go')` → searches GitHub for Go repos if none in graph → ingest → Cypher traversal |
| "beginner TypeScript issues" | same + complexity filter `beginner` |
| "analyse skill gaps for microsoft/vscode" | `analyse_skill_gaps` → finds Skill nodes linked to vscode but not to developer |
| "find related repos" | `find_related_repos` → traverses `CONTRIBUTED_TO`, `FOLLOWS`, `REQUIRES_SKILL` edges |

---

## FalkorDB Highlights

- All developer data, issues, skills, repos, and maintainers are nodes
- Every user action (view, bookmark, skip, apply) is a typed edge with timestamp
- Skipped and applied issues are automatically excluded from future queries
- `FOLLOWS` edges enable social-proximity ranking in a single Cypher query
- Graph grows dynamically as new repos and issues are ingested

---

## Environment Variables

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub PAT (increases rate limit from 60 to 5000 req/hr) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_BASE_URL` | Custom base URL (e.g. Bedrock proxy) |
| `AI_MODEL` | Model ID (default: `claude-sonnet-4-6`) |
| `FALKORDB_HOST` | FalkorDB host (default: `localhost`) |
| `FALKORDB_PORT` | FalkorDB port (default: `6379`) |

---

## Project Structure

```
contrigraph/
├── backend/
│   ├── app/
│   │   ├── graph.py           # All FalkorDB Cypher queries
│   │   ├── github_client.py   # GitHub API wrapper + dynamic repo search
│   │   ├── github_ingestion.py# Developer + repo issue ingestion
│   │   ├── mcp_server.py      # Tool dispatcher (9 tools)
│   │   ├── agent.py           # Claude agent loop, SSE streaming
│   │   └── routes/            # FastAPI routers
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Search.jsx     # Main search + chat interface
│       │   └── Profile.jsx    # Developer graph stats
│       └── components/
│           ├── ChatPanel.jsx  # AI chat + issue action cards
│           ├── SessionHistory.jsx # Graph memory panel
│           ├── ExplorationPanel.jsx # Live graph canvas
│           └── GraphPanel.jsx # Knowledge graph canvas
└── docker-compose.yml
```

---

## Hackathon Tracks

**[Graph Hacks 2026](https://www.wemakedevs.org/hackathons/falkordb#challenge)** by WeMakeDevs + FalkorDB

### Track 01 — Agents That Act on Connected Data

The core insight here is that open source matching is a graph problem, not a search problem. Instead of keyword filtering, ContriGraph executes a multi-hop Cypher traversal across FalkorDB at query time — Developer → Skill → Issue → Repository → Maintainer — ranking results by social proximity and maintainer responsiveness. When a skill isn't in the graph yet, the agent searches GitHub dynamically, ingests the relevant repos, and retries the traversal. The graph grows with every query.

### Track 02 — Agent Memory and Coordination

Most recommendation tools forget you the moment you close the tab. ContriGraph treats every interaction as a first-class graph event. Each issue surfaced by the agent is immediately written as a `VIEWED` edge in FalkorDB with a timestamp and session ID. When a user bookmarks, skips, or marks an issue as applied, that too becomes a typed edge. Every subsequent query reads these edges — skipped issues are permanently filtered out, applied ones are deprioritised, and the agent's understanding of what you've already seen accumulates across sessions. The Profile page reflects this accumulated graph memory.

---

## About

Built solo for Graph Hacks 2026. Graph design, Cypher queries, and product direction by **PRABHU-OFFICIAL-II**.
