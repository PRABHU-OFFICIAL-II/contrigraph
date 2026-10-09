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
    if not username:
        return {"nodes": [], "links": []}

    try:
        g = get_graph()

        nodes_result = g.query(
            """
            MATCH (d:Developer {username: $username})
            OPTIONAL MATCH (d)-[*1..4]-(n)
            WITH collect(d) + collect(n) AS all_nodes
            UNWIND all_nodes AS node
            RETURN DISTINCT id(node) AS nid, labels(node) AS labels, properties(node) AS props
            LIMIT 300
            """,
            {"username": username},
        )
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
                "props": {k: v for k, v in props.items() if k in (
                    "username", "full_name", "name", "stars", "complexity", "avg_response_days"
                )},
            })

        if not node_ids:
            return {"nodes": [], "links": []}

        # Only fetch edges between the nodes we already collected, scoped to this user's subgraph
        edges_result = g.query(
            """
            MATCH (d:Developer {username: $username})-[*1..4]-(a)
            MATCH (a)-[r]->(b)
            WHERE id(b) IN $node_id_list
            RETURN DISTINCT id(a) AS src, id(b) AS tgt, type(r) AS rel
            LIMIT 500
            """,
            {"username": username, "node_id_list": [int(i) for i in node_ids]},
        )
        links = []
        connected_ids = set()
        for row in edges_result.result_set:
            src, tgt, rel_type = row
            if str(src) in node_ids and str(tgt) in node_ids:
                links.append({"source": str(src), "target": str(tgt), "type": rel_type})
                connected_ids.add(str(src))
                connected_ids.add(str(tgt))

        # Also include the developer node itself even if isolated
        dev_nodes = [n for n in nodes if n["type"] == "Developer"]
        connected_nodes = [n for n in nodes if n["id"] in connected_ids]
        all_display = {n["id"]: n for n in dev_nodes + connected_nodes}

        return {"nodes": list(all_display.values()), "links": links}

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
