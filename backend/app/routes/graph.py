from fastapi import APIRouter, Query
from app.graph import get_graph

router = APIRouter()

NODE_COLORS = {
    "Developer": "#da77f2",
    "Repository": "#f0883e",
    "Skill": "#58a6ff",
    "Issue": "#3fb950",
    "Maintainer": "#ffa657",
    "Topic": "#8b949e",
}


def _run(g, cypher, params=None):
    """Run a query and return rows, or [] on error."""
    try:
        r = g.query(cypher, params or {})
        return r.result_set
    except Exception as exc:
        print(f"[graph] query error: {exc}")
        return []


@router.get("/data")
def get_graph_data(username: str = Query(None)):
    if not username:
        return {"nodes": [], "links": []}

    try:
        g = get_graph()
        nodes = {}   # id -> node dict
        links = []

        def add_node(nid, label, name, props=None):
            key = str(nid)
            if key not in nodes:
                nodes[key] = {
                    "id": key,
                    "name": name,
                    "type": label,
                    "color": NODE_COLORS.get(label, "#8b949e"),
                    "val": 8 if label == "Developer" else (4 if label == "Repository" else 2),
                    "props": props or {},
                }

        def add_link(src, tgt, rel):
            links.append({"source": str(src), "target": str(tgt), "type": rel})

        # 1. Developer node
        for row in _run(g, "MATCH (d:Developer {username:$u}) RETURN id(d),d.username,d.name", {"u": username}):
            add_node(row[0], "Developer", row[1] or row[2] or username)

        # 2. Developer → CONTRIBUTED_TO → Repository
        for row in _run(g,
            "MATCH (d:Developer {username:$u})-[:CONTRIBUTED_TO]->(r:Repository) RETURN id(d),id(r),r.full_name,r.stars",
            {"u": username}):
            add_node(row[1], "Repository", row[2] or "", {"full_name": row[2], "stars": row[3]})
            add_link(row[0], row[1], "CONTRIBUTED_TO")

        # 3. Developer → HAS_SKILL → Skill
        for row in _run(g,
            "MATCH (d:Developer {username:$u})-[:HAS_SKILL]->(s:Skill) RETURN id(d),id(s),s.name",
            {"u": username}):
            add_node(row[1], "Skill", row[2] or "")
            add_link(row[0], row[1], "HAS_SKILL")

        # 4. Repos → MAINTAINED_BY → Maintainer  (only repos already in graph)
        for row in _run(g,
            """
            MATCH (d:Developer {username:$u})-[:CONTRIBUTED_TO]->(r:Repository)-[:MAINTAINED_BY]->(m:Maintainer)
            RETURN id(r),id(m),m.username,m.avg_response_days
            """,
            {"u": username}):
            add_node(row[1], "Maintainer", row[2] or "", {"avg_response_days": row[3]})
            add_link(row[0], row[1], "MAINTAINED_BY")

        # 5. Repos the agent explored (developer VIEWED issues from them)
        for row in _run(g,
            """
            MATCH (d:Developer {username:$u})-[:VIEWED]->(i:Issue)<-[:HAS_ISSUE]-(r:Repository)
            RETURN id(d),id(r),r.full_name,r.stars
            """,
            {"u": username}):
            add_node(row[1], "Repository", row[2] or "", {"full_name": row[2], "stars": row[3], "explored": True})
            add_link(row[0], row[1], "EXPLORED")

        # 6. Maintainers of explored repos
        for row in _run(g,
            """
            MATCH (d:Developer {username:$u})-[:VIEWED]->(i:Issue)<-[:HAS_ISSUE]-(r:Repository)-[:MAINTAINED_BY]->(m:Maintainer)
            RETURN id(r),id(m),m.username,m.avg_response_days
            """,
            {"u": username}):
            add_node(row[1], "Maintainer", row[2] or "", {"avg_response_days": row[3]})
            add_link(row[0], row[1], "MAINTAINED_BY")

        # 7. Viewed issues shown directly on graph (limit 20)
        for row in _run(g,
            """
            MATCH (d:Developer {username:$u})-[:VIEWED]->(i:Issue)<-[:HAS_ISSUE]-(r:Repository)
            WHERE i.state = 'open'
            RETURN id(r),id(i),i.title,i.complexity
            LIMIT 20
            """,
            {"u": username}):
            add_node(row[1], "Issue", row[2] or "", {"complexity": row[3]})
            add_link(row[0], row[1], "HAS_ISSUE")

        # 8. Repos → REQUIRES_SKILL (contributed repos only)
        for row in _run(g,
            """
            MATCH (d:Developer {username:$u})-[:CONTRIBUTED_TO]->(r:Repository)-[:REQUIRES_SKILL]->(s:Skill)
            RETURN id(r),id(s)
            """,
            {"u": username}):
            if str(row[0]) in nodes and str(row[1]) in nodes:
                add_link(row[0], row[1], "REQUIRES_SKILL")

        return {"nodes": list(nodes.values()), "links": links}

    except Exception as exc:
        print(f"[graph] get_graph_data error: {exc}")
        return {"nodes": [], "links": []}


@router.get("/exploration")
def get_exploration_data(username: str = Query(None)):
    """Return only the repos/issues/maintainers the agent has explored for this user."""
    if not username:
        return {"repos": []}
    try:
        g = get_graph()
        # Repos the agent explored (user viewed issues from them)
        repo_rows = _run(g,
            """
            MATCH (d:Developer {username:$u})-[:VIEWED]->(i:Issue)<-[:HAS_ISSUE]-(r:Repository)
            OPTIONAL MATCH (r)-[:MAINTAINED_BY]->(m:Maintainer)
            WITH r, m, count(DISTINCT i) AS viewed_count
            RETURN r.full_name, r.stars, m.username, m.avg_response_days, viewed_count
            ORDER BY viewed_count DESC
            """,
            {"u": username})

        repos = []
        for row in repo_rows:
            full_name = row[0]
            if not full_name:
                continue
            # Issues viewed in this repo
            issue_rows = _run(g,
                """
                MATCH (d:Developer {username:$u})-[:VIEWED]->(i:Issue)<-[:HAS_ISSUE]-(r:Repository {full_name:$repo})
                RETURN i.title, i.url, i.complexity
                LIMIT 5
                """,
                {"u": username, "repo": full_name})
            repos.append({
                "full_name": full_name,
                "stars": row[1] or 0,
                "maintainer": row[2] or "",
                "avg_response_days": row[3] or 0,
                "viewed_count": row[4] or 0,
                "issues": [
                    {"title": r[0], "url": r[1], "complexity": r[2]}
                    for r in issue_rows if r[0]
                ],
            })
        return {"repos": repos}
    except Exception as exc:
        print(f"[graph] get_exploration_data error: {exc}")
        return {"repos": []}


@router.get("/profile")
def get_profile_data(username: str = Query(None)):
    """Return structured profile data for the ProfilePanel."""
    if not username:
        return {}
    try:
        g = get_graph()

        # Developer node
        dev_rows = _run(g,
            "MATCH (d:Developer {username:$u}) RETURN d.username,d.name,d.bio,d.followers,d.location,d.github_url",
            {"u": username})
        developer = {}
        if dev_rows:
            r = dev_rows[0]
            developer = {
                "username": r[0] or username,
                "name": r[1] or username,
                "bio": r[2] or "",
                "followers": r[3] or 0,
                "location": r[4] or "",
                "github_url": r[5] or f"https://github.com/{username}",
            }

        # Skills
        skill_rows = _run(g,
            "MATCH (d:Developer {username:$u})-[:HAS_SKILL]->(s:Skill) RETURN s.name, s.category",
            {"u": username})
        skills = [{"name": r[0], "category": r[1] or "other"} for r in skill_rows if r[0]]

        # Contributed repos with full props
        repo_rows = _run(g,
            """
            MATCH (d:Developer {username:$u})-[:CONTRIBUTED_TO]->(r:Repository)
            RETURN r.full_name, r.name, r.description, r.stars, r.forks,
                   r.primary_language, r.last_commit_days_ago, r.open_issues_count
            ORDER BY r.stars DESC
            LIMIT 20
            """,
            {"u": username})
        repos = [
            {
                "full_name": r[0] or "",
                "name": r[1] or "",
                "description": r[2] or "",
                "stars": r[3] or 0,
                "forks": r[4] or 0,
                "primary_language": r[5] or "",
                "last_commit_days_ago": r[6] or 0,
                "open_issues_count": r[7] or 0,
            }
            for r in repo_rows if r[0]
        ]

        # Following developers
        following_rows = _run(g,
            "MATCH (d:Developer {username:$u})-[:FOLLOWS]->(f:Developer) RETURN f.username LIMIT 20",
            {"u": username})
        following = [r[0] for r in following_rows if r[0]]

        # Maintainers of external repos (repos with issues ingested)
        maintainer_rows = _run(g,
            """
            MATCH (r:Repository)-[:MAINTAINED_BY]->(m:Maintainer)
            WHERE (r)-[:HAS_ISSUE]->(:Issue)
            RETURN m.username, m.avg_response_days, r.full_name
            LIMIT 10
            """,
            {"u": username})
        maintainers = [
            {"username": r[0], "avg_response_days": r[1] or 0, "repo": r[2]}
            for r in maintainer_rows if r[0]
        ]

        return {
            "developer": developer,
            "skills": skills,
            "repos": repos,
            "following": following,
            "maintainers": maintainers,
        }
    except Exception as exc:
        print(f"[graph] get_profile_data error: {exc}")
        return {}


@router.get("/highlight")
def get_highlighted_path(username: str = Query(...), repo: str = Query(...)):
    try:
        g = get_graph()
        result = g.query(
            """
            MATCH path = shortestPath(
              (d:Developer {username: $username})-[:CONTRIBUTED_TO|FOLLOWS*..5]-(r:Repository {full_name: $repo})
            )
            RETURN [n IN nodes(path) | id(n)] AS node_ids
            """,
            {"username": username, "repo": repo},
        )
        if result.result_set:
            return {"highlighted": [str(i) for i in result.result_set[0][0]]}
        return {"highlighted": []}
    except Exception as exc:
        print(f"[graph] get_highlighted_path error: {exc}")
        return {"highlighted": []}
