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

        # 5. Repos → HAS_ISSUE → Issue  (limit to 30 most recent)
        for row in _run(g,
            """
            MATCH (d:Developer {username:$u})-[:CONTRIBUTED_TO]->(r:Repository)-[:HAS_ISSUE]->(i:Issue)
            WHERE i.state = 'open'
            RETURN id(r),id(i),i.title,i.complexity
            LIMIT 30
            """,
            {"u": username}):
            add_node(row[1], "Issue", row[2] or "", {"complexity": row[3]})
            add_link(row[0], row[1], "HAS_ISSUE")

        # 6. Repos → REQUIRES_SKILL → Skill  (only skills already in graph)
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
