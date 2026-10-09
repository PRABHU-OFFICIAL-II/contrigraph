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


@router.get("/data")
def get_graph_data(username: str = Query(None)):
    """Return all nodes and edges for the graph visualiser."""
    g = get_graph()

    # Fetch all nodes with their labels
    nodes_result = g.query("MATCH (n) RETURN id(n) AS nid, labels(n) AS labels, properties(n) AS props LIMIT 300")
    nodes = []
    node_ids = set()
    for row in nodes_result.result_set:
        nid, labels, props = row
        if str(nid) in node_ids:
            continue
        node_ids.add(str(nid))
        label = labels[0] if labels else "Unknown"
        name = (
            props.get("username") or props.get("full_name") or
            props.get("name") or props.get("title") or str(nid)
        )
        is_current_user = (label == "Developer" and props.get("username") == username)
        nodes.append({
            "id": str(nid),
            "name": name,
            "type": label,
            "color": NODE_COLORS.get(label, "#8b949e"),
            "val": 8 if is_current_user else (4 if label == "Repository" else 2),
            "props": {k: v for k, v in props.items() if k in ("username", "full_name", "name", "stars", "complexity", "avg_response_days")},
        })

    # Fetch all edges
    edges_result = g.query("MATCH (a)-[r]->(b) RETURN id(a), id(b), type(r) LIMIT 500")
    links = []
    connected_ids = set()
    for row in edges_result.result_set:
        src, tgt, rel_type = row
        if str(src) in node_ids and str(tgt) in node_ids:
            links.append({
                "source": str(src),
                "target": str(tgt),
                "type": rel_type,
            })
            connected_ids.add(str(src))
            connected_ids.add(str(tgt))

    # Only return nodes that participate in at least one edge
    connected_nodes = [n for n in nodes if n["id"] in connected_ids]

    return {"nodes": connected_nodes, "links": links}


@router.get("/highlight")
def get_highlighted_path(username: str = Query(...), repo: str = Query(...)):
    """Return node IDs that form the shortest path between developer and repo."""
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
