# ContriGraph — Complete Build Briefing

## What We Are Building

**ContriGraph** is an AI agent that helps developers find the perfect open source issues to contribute to — powered by FalkorDB as its graph context layer.

**Tagline:** "Find your path in open source. One graph at a time."

**Hackathon:** Graph Hacks by WeMakeDevs + FalkorDB — Oct 15–18, 2026
**Tracks:** Track 01 (Agents That Act on Connected Data) + Track 02 (Agent Memory and Coordination)
**Prize per track:** iPhone 18 Pro (Track 01) + PS5 with GTA VI (Track 02)

---

## The Problem We Are Solving

Every developer wants to contribute to open source but hits the same wall:
- Which repo is a good fit for my skills?
- Which issues are actually beginner-friendly vs. just labeled that way?
- Will the maintainer even respond?
- Is anyone I know already involved in this project?
- What should I learn next to contribute to X?

Answering these questions today means opening 10 browser tabs, manually reading READMEs, hoping for the best. ContriGraph answers all of them in one conversational query — by traversing a knowledge graph that connects developers, skills, repos, issues, and maintainer activity.

---

## Why FalkorDB Is the Core (Not Decoration)

The hackathon rules say: "If the product still works once FalkorDB is taken out, the graph is decoration."

ContriGraph breaks entirely without FalkorDB:
- The multi-hop query that finds "issues matching my skills WHERE maintainer responds fast AND a connection of mine contributed" cannot be done efficiently without a graph database
- The session memory (what issues I explored, what I bookmarked, what I skipped) is stored as graph relationships
- The connection path ("you are 2 hops from this repo via your friend who contributed") requires shortest-path graph algorithms
- Related repo discovery uses graph topology (repos sharing topics and contributors)

---

## Full Tech Stack

| Layer | Technology |
|---|---|
| Graph Database | FalkorDB (Docker) — PRIMARY data store |
| AI Model | Claude (Anthropic SDK) — claude-sonnet-4-6 |
| Agent Protocol | MCP (Model Context Protocol) — Python server |
| Backend | FastAPI (Python 3.11) |
| Frontend | React 18 + Vite |
| Data Source | GitHub REST API v3 (public, no auth needed for basic use) |
| Deployment | Docker Compose (local) + optional Vercel (frontend) + Railway (backend) |

---

## FalkorDB Graph Schema

### Nodes

```cypher
-- Developer: the user of ContriGraph
CREATE (:Developer {
  username: "prabhu",
  name: "Prabhu Prasad",
  bio: "...",
  followers: 120,
  github_url: "https://github.com/prabhu",
  location: "Bangalore",
  created_at: datetime()
})

-- Skill: a technology or language
CREATE (:Skill { name: "python", category: "language" })
CREATE (:Skill { name: "fastapi", category: "framework" })
CREATE (:Skill { name: "react", category: "framework" })
CREATE (:Skill { name: "graph-databases", category: "domain" })

-- Repository: a GitHub repository
CREATE (:Repository {
  full_name: "tiangolo/fastapi",
  name: "fastapi",
  description: "FastAPI framework...",
  stars: 78000,
  forks: 6500,
  primary_language: "Python",
  open_issues_count: 240,
  health_score: 95,
  last_commit_days_ago: 2
})

-- Issue: an open GitHub issue
CREATE (:Issue {
  id: "fastapi_1234",
  number: 1234,
  title: "Add example for background tasks",
  body: "...",
  labels: ["good first issue", "documentation"],
  state: "open",
  complexity: "beginner",
  comments: 3,
  created_at: datetime(),
  url: "https://github.com/tiangolo/fastapi/issues/1234"
})

-- Maintainer: the person who owns/maintains the repo
CREATE (:Maintainer {
  username: "tiangolo",
  name: "Sebastian",
  avg_response_days: 2.5,
  total_issues_closed: 1800,
  is_active: true
})

-- Topic: a GitHub topic tag
CREATE (:Topic { name: "web-framework" })
CREATE (:Topic { name: "python" })
CREATE (:Topic { name: "api" })
```

### Relationships

```cypher
-- Developer skill relationships
(Developer)-[:HAS_SKILL { level: "expert" }]->(Skill)
-- level can be: "expert", "intermediate", "beginner", "learning"

-- Developer contribution history
(Developer)-[:CONTRIBUTED_TO { commits: 5, prs: 2, last_contribution: date() }]->(Repository)

-- Developer social graph
(Developer)-[:FOLLOWS]->(Developer)

-- Repository structure
(Repository)-[:REQUIRES_SKILL]->(Skill)
(Repository)-[:HAS_ISSUE]->(Issue)
(Repository)-[:MAINTAINED_BY]->(Maintainer)
(Repository)-[:TAGGED_WITH]->(Topic)
(Repository)-[:RELATED_TO { shared_topics: 3 }]->(Repository)

-- Issue skill requirements
(Issue)-[:NEEDS_SKILL]->(Skill)

-- Maintainer responses
(Maintainer)-[:RESPONDED_TO { days_taken: 1 }]->(Issue)

-- Session memory (Track 02 — persisted across sessions)
(Developer)-[:VIEWED { timestamp: datetime(), session_id: "abc" }]->(Issue)
(Developer)-[:BOOKMARKED { timestamp: datetime() }]->(Issue)
(Developer)-[:SKIPPED { reason: "too complex" }]->(Issue)
(Developer)-[:APPLIED_TO { timestamp: datetime() }]->(Issue)
```

---

## Key Cypher Queries (The Core of the Product)

### Query 1 — Main Recommendation Query (Multi-hop)
```cypher
MATCH (d:Developer {username: $username})-[:HAS_SKILL]->(s:Skill)<-[:NEEDS_SKILL]-(i:Issue)<-[:HAS_ISSUE]-(r:Repository)-[:MAINTAINED_BY]->(m:Maintainer)
WHERE i.state = 'open'
  AND m.avg_response_days <= $max_response_days
  AND NOT EXISTS {
    MATCH (d)-[:SKIPPED]->(i)
  }
  AND NOT EXISTS {
    MATCH (d)-[:APPLIED_TO]->(i)
  }
OPTIONAL MATCH (friend:Developer)-[:FOLLOWS]-(d)-[:FOLLOWS]-(friend),
               (friend)-[:CONTRIBUTED_TO]->(r)
WITH i, r, m, count(DISTINCT friend) AS friend_contributors,
     collect(DISTINCT friend.username) AS friend_names
RETURN i.title, i.url, i.complexity, r.full_name, r.stars,
       m.username, m.avg_response_days,
       friend_contributors, friend_names
ORDER BY friend_contributors DESC, m.avg_response_days ASC, r.stars DESC
LIMIT $limit
```

### Query 2 — Skill Gap Analysis
```cypher
MATCH (r:Repository {full_name: $repo})-[:REQUIRES_SKILL]->(s:Skill)
WHERE NOT EXISTS {
  MATCH (d:Developer {username: $username})-[:HAS_SKILL]->(s)
}
RETURN s.name AS missing_skill, s.category
ORDER BY s.category
```

### Query 3 — Connection Path to a Repo
```cypher
MATCH path = shortestPath(
  (d:Developer {username: $username})-[:CONTRIBUTED_TO|FOLLOWS*..5]-(r:Repository {full_name: $repo})
)
RETURN path, length(path) AS hops
```

### Query 4 — Related Repos via Graph Topology
```cypher
MATCH (d:Developer {username: $username})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES_SKILL]-(r:Repository)
WHERE NOT EXISTS { MATCH (d)-[:CONTRIBUTED_TO]->(r) }
WITH r, count(s) AS skill_matches
MATCH (r)-[:TAGGED_WITH]->(t:Topic)<-[:TAGGED_WITH]-(related:Repository)
WHERE related <> r
RETURN related.full_name, related.description, related.stars,
       count(t) AS shared_topics, skill_matches
ORDER BY shared_topics DESC, skill_matches DESC
LIMIT 10
```

### Query 5 — Session Memory (What I Explored Before)
```cypher
MATCH (d:Developer {username: $username})-[v:VIEWED]->(i:Issue)<-[:HAS_ISSUE]-(r:Repository)
WHERE v.timestamp > datetime() - duration('P7D')
RETURN i.title, i.url, r.full_name, v.timestamp, v.session_id
ORDER BY v.timestamp DESC
LIMIT 20
```

### Query 6 — Repo Health Score
```cypher
MATCH (r:Repository {full_name: $repo})-[:MAINTAINED_BY]->(m:Maintainer)
MATCH (r)-[:HAS_ISSUE]->(i:Issue)
WITH r, m,
     count(i) AS total_issues,
     count(CASE WHEN i.state = 'open' THEN 1 END) AS open_issues,
     avg(CASE WHEN i.state = 'closed' THEN 1.0 ELSE 0.0 END) AS close_rate
RETURN r.full_name, r.stars, m.avg_response_days, m.is_active,
       total_issues, open_issues, close_rate,
       r.last_commit_days_ago AS days_since_last_commit
```

---

## MCP Server Tools

Build these as MCP tools in `backend/app/mcp_server.py`. Each tool is a function Claude can call.

```python
# Tool 1 — Ingest a developer's GitHub profile into FalkorDB
@tool("ingest_developer")
def ingest_developer(github_username: str) -> dict:
    """
    Fetch developer profile, repos, skills, and social connections
    from GitHub API and store all nodes + relationships in FalkorDB.
    Returns summary of what was ingested.
    """

# Tool 2 — Find matching issues (THE main query)
@tool("find_matching_issues")
def find_matching_issues(
    username: str,
    max_response_days: int = 7,
    complexity: str = "beginner",
    limit: int = 10
) -> list[dict]:
    """
    Multi-hop FalkorDB query: find open issues that match the developer's skills,
    where the maintainer is active, and friends have contributed.
    Returns ranked list of issues with context.
    """

# Tool 3 — Analyse skill gaps for a target repo
@tool("analyse_skill_gaps")
def analyse_skill_gaps(username: str, repo_full_name: str) -> dict:
    """
    Query FalkorDB to find which skills the target repo needs
    that the developer doesn't have yet. Returns learning suggestions.
    """

# Tool 4 — Find connection path to a repo
@tool("find_connection_path")
def find_connection_path(username: str, repo_full_name: str) -> dict:
    """
    Run shortest-path algorithm in FalkorDB between the developer
    and the repo via CONTRIBUTED_TO and FOLLOWS relationships.
    Returns the path with hop count.
    """

# Tool 5 — Find related repos
@tool("find_related_repos")
def find_related_repos(username: str, limit: int = 8) -> list[dict]:
    """
    Traverse FalkorDB to find repos related to developer's skills
    and similar to repos they've already contributed to.
    """

# Tool 6 — Get repo health
@tool("get_repo_health")
def get_repo_health(repo_full_name: str) -> dict:
    """
    Query FalkorDB for maintainer activity, response times,
    issue close rates, and last commit time for a repo.
    """

# Tool 7 — Remember session action (Track 02 — memory)
@tool("remember_action")
def remember_action(
    username: str,
    issue_id: str,
    action: str,  # "viewed" | "bookmarked" | "skipped" | "applied"
    session_id: str,
    reason: str = None
) -> dict:
    """
    Write a relationship to FalkorDB recording what the developer
    did with this issue. This is the persistent session memory.
    """

# Tool 8 — Get session history (Track 02 — recall)
@tool("get_session_history")
def get_session_history(username: str, days_back: int = 7) -> list[dict]:
    """
    Query FalkorDB for all issues the developer viewed, bookmarked,
    or applied to in the past N days. Used to resume a session.
    """

# Tool 9 — Ingest a repo's issues into FalkorDB
@tool("ingest_repo_issues")
def ingest_repo_issues(repo_full_name: str) -> dict:
    """
    Fetch all open issues from GitHub API for the given repo,
    classify them by complexity, extract skill requirements,
    and store in FalkorDB as Issue nodes with relationships.
    """
```

---

## Agent System Prompt

```python
SYSTEM_PROMPT = """
You are ContriGraph, an AI agent that helps developers find their perfect open source contribution path.

You have access to a FalkorDB knowledge graph that contains:
- Developer profiles with their skills and contribution history
- GitHub repositories with their issues, topics, and health data
- Maintainer activity and response time data
- Social connections between developers
- The developer's session memory — what they explored before

Your job is to:
1. Understand what the developer is looking for (skill level, interest area, time availability)
2. Use your FalkorDB tools to traverse the graph and find the best matching issues
3. Explain WHY each recommendation matches them — reference the graph path
4. Remember what they explore, bookmark, and skip across sessions
5. Help them understand skill gaps and learning paths

Always explain your reasoning by referencing the graph connections:
- "I found this issue because you know Python, and this repo requires Python, and your connection @alice contributed there last month"
- "The maintainer responds in an average of 2 days based on 47 past issues in the graph"
- "You are 2 hops from this repo: you follow @bob who contributed to it"

Be specific, be traceable. Every recommendation should come with a graph-backed reason.
"""
```

---

## Project Folder Structure

```
contrigraph/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── graph.py              # FalkorDB connection + all Cypher queries
│   │   ├── github_client.py      # GitHub API calls (requests library)
│   │   ├── github_ingestion.py   # GitHub data → FalkorDB nodes/relationships
│   │   ├── mcp_server.py         # MCP server exposing all 9 tools to Claude
│   │   ├── agent.py              # Claude agent loop + streaming
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── chat.py           # POST /api/chat — agent conversation
│   │       ├── developer.py      # POST /api/developer/ingest, GET /api/developer/{username}
│   │       ├── search.py         # GET /api/search/issues
│   │       └── session.py        # GET/POST /api/session/{username}
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx        # AI conversation panel (streaming)
│   │   │   ├── IssueCard.jsx        # Issue recommendation card
│   │   │   ├── GraphPath.jsx        # Visualise the connection path
│   │   │   ├── SkillProfile.jsx     # Developer skills + gaps
│   │   │   └── SessionHistory.jsx   # Past explorations from memory
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Login with GitHub username
│   │   │   ├── Search.jsx           # Main search + agent chat
│   │   │   └── Profile.jsx          # Developer profile + graph stats
│   │   └── utils/
│   │       └── api.js               # API client
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml               # FalkorDB + backend + frontend
├── README.md                        # Hackathon submission README
├── CLAUDE.md                        # This file
└── docs/
    ├── graph_schema.md              # Full schema documentation
    └── cypher_queries.md            # All queries with explanations
```

---

## docker-compose.yml (Base)

```yaml
version: "3.9"
services:
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6379:6379"
      - "3000:3000"
    volumes:
      - falkordb_data:/data
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - FALKORDB_HOST=falkordb
      - FALKORDB_PORT=6379
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    depends_on:
      - falkordb
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  falkordb_data:
```

---

## requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
falkordb==1.0.8
anthropic==0.40.0
mcp==1.0.0
requests==2.32.3
python-dotenv==1.0.1
pydantic==2.9.0
httpx==0.27.2
```

---

## GitHub API Endpoints to Use

```python
# All public — no auth required for basic use, auth = higher rate limits

# Developer profile
GET https://api.github.com/users/{username}

# Developer's repos
GET https://api.github.com/users/{username}/repos?per_page=100&sort=pushed

# Developer's following (social graph)
GET https://api.github.com/users/{username}/following?per_page=100

# Repo topics
GET https://api.github.com/repos/{owner}/{repo}/topics
Headers: {"Accept": "application/vnd.github.mercy-preview+json"}

# Repo issues (good first issue label)
GET https://api.github.com/repos/{owner}/{repo}/issues?labels=good+first+issue&state=open&per_page=50

# Issue comments (to estimate maintainer response time)
GET https://api.github.com/repos/{owner}/{repo}/issues/{number}/comments

# Contributors
GET https://api.github.com/repos/{owner}/{repo}/contributors?per_page=50
```

Set `GITHUB_TOKEN` in `.env` for 5000 req/hour instead of 60 req/hour.

---

## GitHub Token Scopes Needed

```
GITHUB_TOKEN = a classic personal access token with:
  - public_repo (read public repos)
  - read:user (read user profiles)
No write scopes needed. All data is public.
```

---

## Day-by-Day Build Plan

### Day 1 — Oct 15: Foundation

Goals: FalkorDB running, graph seeded with real data, all MCP tools responding

Tasks:
1. `docker-compose up -d falkordb` — verify FalkorDB Browser at localhost:3000
2. Build `graph.py` — FalkorDB connection class + all 6 Cypher query functions
3. Build `github_client.py` — wrapper for all GitHub API calls
4. Build `github_ingestion.py` — takes a GitHub username, fetches profile + repos + following, creates all nodes and relationships in FalkorDB
5. Build `mcp_server.py` — register all 9 tools using the `mcp` library
6. Test: ingest your own GitHub profile, run the recommendation query in FalkorDB Browser, verify you get results
7. FastAPI `main.py` skeleton with health check endpoint

Done when: You can run `python -c "from app.github_ingestion import ingest_developer; ingest_developer('torvalds')"` and see nodes in FalkorDB Browser.

### Day 2 — Oct 16: Agent + Full Flow

Goals: Claude agent working end-to-end via MCP, session memory writing to FalkorDB

Tasks:
1. Build `agent.py` — Claude streaming agent loop that uses MCP tools
2. Build `routes/chat.py` — POST /api/chat endpoint, streams Claude responses
3. Build `routes/developer.py` — ingest endpoint + profile endpoint
4. Test full conversation: "I know Python and React, find me beginner issues with active maintainers"
5. Verify session memory: after viewing issues, check FalkorDB Browser shows VIEWED relationships
6. Build React `ChatPanel.jsx` + `IssueCard.jsx` (basic, functional)
7. Connect frontend to backend

Done when: You can have a real conversation with the agent in the browser and see FalkorDB getting updated.

### Day 3 — Oct 17: Polish + Blog Post

Goals: UI polished, graph visualiser working, blog post written, demo video recorded

Tasks:
1. Build `GraphPath.jsx` — show the connection path visually (simple node-edge diagram, use react-force-graph or vis-network)
2. Build `SessionHistory.jsx` — show what user explored before (from FalkorDB memory)
3. Build `SkillProfile.jsx` — developer skills + gap analysis for a chosen repo
4. Add loading states, error handling, toast notifications
5. Write the blog post (required for AirPods 5 side prize):
   - Problem statement
   - Why graph database (not vector DB, not relational)
   - FalkorDB schema walkthrough with a diagram
   - Key Cypher query explained step by step
   - Demo screenshots
   - Lessons learned
6. Record demo video (5–7 min):
   - Show empty FalkorDB
   - Ingest a developer profile
   - Ask the agent a question
   - Show the graph being traversed (FalkorDB Browser)
   - Show session memory persisting after page refresh

Done when: Demo video is recorded and blog post draft is ready.

### Day 4 — Oct 18: Deploy + Submit

Goals: Live deployment, README complete, submitted before 11:59 PM IST

Tasks:
1. Deploy frontend to Vercel
2. Deploy backend + FalkorDB to Railway or Render (or provide docker-compose for local)
3. Write README.md with:
   - Project description
   - Graph data model (schema diagram)
   - The 6 Cypher queries with explanations
   - Setup instructions (docker-compose up)
   - Demo video link
   - Blog post link
   - Tracks entered
   - AI tool disclosure
4. Push to public GitHub repo
5. Submit on the hackathon platform before 11:59 PM IST

---

## README Structure (Hackathon Requirement)

The README must include all of these per Rule 10:

```markdown
# ContriGraph

> Find your path in open source. One graph at a time.

## What it does
[2-3 paragraphs]

## Tracks entered
- Track 01: Agents That Act on Connected Data
- Track 02: Agent Memory and Coordination

## Graph Data Model
[Schema diagram image]
[Node and relationship descriptions]

## Key Cypher Queries
[All 6 queries with explanations]

## Architecture
[Architecture diagram]

## Setup
docker-compose up -d
[step by step]

## Demo
[Video link]
[Blog post link]

## AI Tools Used
Claude Code was used as a coding assistant during development.
All code was written, reviewed, and understood by the team.

## Tech Stack
FalkorDB | FastAPI | Claude | MCP | React | GitHub API
```

---

## Things to Prepare Before Oct 15 (Allowed by Rules)

These are all allowed (rule 8 says: notes, graph model sketches, diagrams are fine):

1. Create a GitHub personal access token (takes 2 minutes)
2. Get an Anthropic API key
3. Pull FalkorDB Docker image: `docker pull falkordb/falkordb:latest`
4. Install Python deps: `pip install falkordb anthropic mcp requests fastapi uvicorn`
5. Sketch the graph schema on paper
6. Write the 6 Cypher queries in FalkorDB Browser with dummy data to verify they work
7. Scaffold the folder structure (already done — you are in it)
8. Read FalkorDB Python client docs: https://github.com/FalkorDB/falkordb-py

---

## Important Notes

1. **FalkorDB must be the PRIMARY store** — all data lives in FalkorDB, not in a separate SQL/Postgres DB
2. **The graph must do real work** — removing FalkorDB must break the product
3. **Use synthetic or public data only** — GitHub public API is fine, do not use private org data
4. **Disclose AI tool use** — add "Claude Code was used as a coding assistant" to README
5. **You must understand everything** — judges may ask you to explain the graph model and Cypher queries
6. **Session memory must persist** — after closing the browser and reopening, the agent must remember what you explored (read from FalkorDB)

---

## Winning Criteria Checklist

- [ ] Multi-hop graph reasoning (Query 1 traverses 4+ node types)
- [ ] Graph queries as agent tools (all 9 MCP tools use Cypher)
- [ ] Tool selection through MCP (Claude decides which tool to call)
- [ ] Actions based on what the graph shows (recommendations change with graph state)
- [ ] Explainable results (agent cites graph paths in responses)
- [ ] Episodic memory (VIEWED/BOOKMARKED/SKIPPED relationships per session)
- [ ] Persistent across sessions (memory survives page refresh)
- [ ] High-concurrency reads (FalkorDB handles multiple users via multigraph)
- [ ] Separate memory per user (Developer node username is the key)
- [ ] Demo video showing working project
- [ ] Live deployment or complete local setup
- [ ] README with schema + Cypher queries
- [ ] Blog post (for AirPods 5 side prize)
