import os
from falkordb import FalkorDB

_client = None
_graph = None


def _row_to_dict(header, row):
    """Convert a FalkorDB result row to a dict, handling both str and (type,name) header formats."""
    keys = []
    for h in header:
        if isinstance(h, (list, tuple)):
            keys.append(h[1] if len(h) > 1 else str(h[0]))
        else:
            keys.append(str(h))
    return dict(zip(keys, row))

def get_graph():
    global _client, _graph
    if _graph is None:
        host = os.getenv("FALKORDB_HOST", "localhost")
        port = int(os.getenv("FALKORDB_PORT", 6379))
        _client = FalkorDB(host=host, port=port)
        _graph = _client.select_graph("contrigraph")
    return _graph


# ── Node creation helpers ──────────────────────────────────────────────────────

def upsert_developer(data: dict):
    g = get_graph()
    g.query(
        """
        MERGE (d:Developer {username: $username})
        SET d.name = $name,
            d.bio = $bio,
            d.followers = $followers,
            d.github_url = $github_url,
            d.location = $location
        """,
        {
            "username": data.get("username", ""),
            "name": data.get("name", ""),
            "bio": data.get("bio", ""),
            "followers": data.get("followers", 0),
            "github_url": data.get("github_url", ""),
            "location": data.get("location", ""),
        },
    )


def upsert_skill(name: str, category: str = "language"):
    g = get_graph()
    g.query(
        "MERGE (s:Skill {name: $name}) SET s.category = $category",
        {"name": name, "category": category},
    )


def upsert_repository(data: dict):
    g = get_graph()
    g.query(
        """
        MERGE (r:Repository {full_name: $full_name})
        SET r.name = $name,
            r.description = $description,
            r.stars = $stars,
            r.forks = $forks,
            r.primary_language = $primary_language,
            r.open_issues_count = $open_issues_count,
            r.last_commit_days_ago = $last_commit_days_ago
        """,
        {
            "full_name": data.get("full_name", ""),
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "stars": data.get("stars", 0),
            "forks": data.get("forks", 0),
            "primary_language": data.get("primary_language", ""),
            "open_issues_count": data.get("open_issues_count", 0),
            "last_commit_days_ago": data.get("last_commit_days_ago", 999),
        },
    )


def upsert_issue(data: dict):
    g = get_graph()
    g.query(
        """
        MERGE (i:Issue {id: $id})
        SET i.number = $number,
            i.title = $title,
            i.body = $body,
            i.labels = $labels,
            i.state = $state,
            i.complexity = $complexity,
            i.comments = $comments,
            i.url = $url
        """,
        {
            "id": data.get("id", ""),
            "number": data.get("number", 0),
            "title": data.get("title", ""),
            "body": data.get("body", ""),
            "labels": data.get("labels", []),
            "state": data.get("state", "open"),
            "complexity": data.get("complexity", "unknown"),
            "comments": data.get("comments", 0),
            "url": data.get("url", ""),
        },
    )


def upsert_maintainer(data: dict):
    g = get_graph()
    g.query(
        """
        MERGE (m:Maintainer {username: $username})
        SET m.name = $name,
            m.avg_response_days = $avg_response_days,
            m.total_issues_closed = $total_issues_closed,
            m.is_active = $is_active
        """,
        {
            "username": data.get("username", ""),
            "name": data.get("name", ""),
            "avg_response_days": data.get("avg_response_days", 999.0),
            "total_issues_closed": data.get("total_issues_closed", 0),
            "is_active": data.get("is_active", True),
        },
    )


def upsert_topic(name: str):
    g = get_graph()
    g.query("MERGE (t:Topic {name: $name})", {"name": name})


# ── Relationship helpers ───────────────────────────────────────────────────────

def link_developer_skill(username: str, skill: str, level: str = "intermediate"):
    g = get_graph()
    g.query(
        """
        MATCH (d:Developer {username: $username})
        MATCH (s:Skill {name: $skill})
        MERGE (d)-[r:HAS_SKILL]->(s)
        SET r.level = $level
        """,
        {"username": username, "skill": skill, "level": level},
    )


def link_developer_repo(username: str, full_name: str, commits: int = 0, prs: int = 0):
    g = get_graph()
    g.query(
        """
        MATCH (d:Developer {username: $username})
        MATCH (r:Repository {full_name: $full_name})
        MERGE (d)-[c:CONTRIBUTED_TO]->(r)
        SET c.commits = $commits, c.prs = $prs
        """,
        {"username": username, "full_name": full_name, "commits": commits, "prs": prs},
    )


def link_developer_follows(follower: str, followee: str):
    g = get_graph()
    g.query(
        """
        MATCH (a:Developer {username: $follower})
        MATCH (b:Developer {username: $followee})
        MERGE (a)-[:FOLLOWS]->(b)
        """,
        {"follower": follower, "followee": followee},
    )


def link_repo_issue(full_name: str, issue_id: str):
    g = get_graph()
    g.query(
        """
        MATCH (r:Repository {full_name: $full_name})
        MATCH (i:Issue {id: $issue_id})
        MERGE (r)-[:HAS_ISSUE]->(i)
        """,
        {"full_name": full_name, "issue_id": issue_id},
    )


def link_repo_maintainer(full_name: str, maintainer_username: str):
    g = get_graph()
    g.query(
        """
        MATCH (r:Repository {full_name: $full_name})
        MATCH (m:Maintainer {username: $maintainer_username})
        MERGE (r)-[:MAINTAINED_BY]->(m)
        """,
        {"full_name": full_name, "maintainer_username": maintainer_username},
    )


def link_repo_topic(full_name: str, topic: str):
    g = get_graph()
    g.query(
        """
        MATCH (r:Repository {full_name: $full_name})
        MATCH (t:Topic {name: $topic})
        MERGE (r)-[:TAGGED_WITH]->(t)
        """,
        {"full_name": full_name, "topic": topic},
    )


def link_repo_skill(full_name: str, skill: str):
    g = get_graph()
    g.query(
        """
        MATCH (r:Repository {full_name: $full_name})
        MATCH (s:Skill {name: $skill})
        MERGE (r)-[:REQUIRES_SKILL]->(s)
        """,
        {"full_name": full_name, "skill": skill},
    )


def link_issue_skill(issue_id: str, skill: str):
    g = get_graph()
    g.query(
        """
        MATCH (i:Issue {id: $issue_id})
        MATCH (s:Skill {name: $skill})
        MERGE (i)-[:NEEDS_SKILL]->(s)
        """,
        {"issue_id": issue_id, "skill": skill},
    )


# ── Core Cypher queries ────────────────────────────────────────────────────────

def query_matching_issues(username: str, max_response_days: int = 30, complexity: str = None, limit: int = 10) -> list:
    g = get_graph()
    complexity_filter = "AND i.complexity = $complexity" if complexity else ""
    result = g.query(
        f"""
        MATCH (d:Developer {{username: $username}})-[:HAS_SKILL]->(s:Skill)<-[:NEEDS_SKILL]-(i:Issue)<-[:HAS_ISSUE]-(r:Repository)-[:MAINTAINED_BY]->(m:Maintainer)
        WHERE i.state = 'open'
          AND m.avg_response_days <= $max_response_days
          {complexity_filter}
          AND NOT (d)-[:SKIPPED]->(i)
          AND NOT (d)-[:APPLIED_TO]->(i)
        OPTIONAL MATCH (friend:Developer)-[:FOLLOWS]-(d)-[:FOLLOWS]-(friend),
                       (friend)-[:CONTRIBUTED_TO]->(r)
        WITH i, r, m, count(DISTINCT friend) AS friend_contributors,
             collect(DISTINCT friend.username) AS friend_names
        RETURN i.title AS title, i.url AS url, i.complexity AS complexity,
               i.id AS issue_id, r.full_name AS repo, r.stars AS stars,
               m.username AS maintainer, m.avg_response_days AS response_days,
               friend_contributors, friend_names
        ORDER BY friend_contributors DESC, m.avg_response_days ASC, r.stars DESC
        LIMIT $limit
        """,
        {"username": username, "max_response_days": max_response_days, "complexity": complexity or "", "limit": limit},
    )
    return [_row_to_dict(result.header, row) for row in result.result_set]


def get_repos_without_issues(username: str, limit: int = 10) -> list[str]:
    """Return skill-matched external repos (not owned/contributed-to by user) with no issues yet."""
    g = get_graph()
    result = g.query(
        """
        MATCH (d:Developer {username: $username})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES_SKILL]-(r:Repository)
        WHERE NOT (r)-[:HAS_ISSUE]->(:Issue)
          AND NOT (d)-[:CONTRIBUTED_TO]->(r)
        RETURN DISTINCT r.full_name AS full_name
        LIMIT $limit
        """,
        {"username": username, "limit": limit},
    )
    return [row[0] for row in result.result_set if row[0]]


def query_skill_gaps(username: str, repo_full_name: str) -> list:
    g = get_graph()
    result = g.query(
        """
        MATCH (r:Repository {full_name: $repo})-[:REQUIRES_SKILL]->(s:Skill)
        MATCH (d:Developer {username: $username})
        WHERE NOT (d)-[:HAS_SKILL]->(s)
        RETURN s.name AS missing_skill, s.category AS category
        ORDER BY s.category
        """,
        {"username": username, "repo": repo_full_name},
    )
    return [_row_to_dict(result.header, row) for row in result.result_set]


def query_connection_path(username: str, repo_full_name: str) -> dict:
    g = get_graph()
    result = g.query(
        """
        MATCH path = shortestPath(
          (d:Developer {username: $username})-[:CONTRIBUTED_TO|FOLLOWS*..5]-(r:Repository {full_name: $repo})
        )
        RETURN path, length(path) AS hops
        """,
        {"username": username, "repo": repo_full_name},
    )
    if result.result_set:
        row = result.result_set[0]
        return {"path": str(row[0]), "hops": row[1]}
    return {"path": None, "hops": -1}


def query_related_repos(username: str, limit: int = 10) -> list:
    g = get_graph()
    result = g.query(
        """
        MATCH (d:Developer {username: $username})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES_SKILL]-(r:Repository)
        WHERE NOT (d)-[:CONTRIBUTED_TO]->(r)
        WITH r, count(s) AS skill_matches
        MATCH (r)-[:TAGGED_WITH]->(t:Topic)<-[:TAGGED_WITH]-(related:Repository)
        WHERE related <> r
        RETURN related.full_name AS full_name, related.description AS description,
               related.stars AS stars,
               count(t) AS shared_topics, skill_matches
        ORDER BY shared_topics DESC, skill_matches DESC
        LIMIT $limit
        """,
        {"username": username, "limit": limit},
    )
    return [_row_to_dict(result.header, row) for row in result.result_set]


def query_session_history(username: str, days_back: int = 7) -> list:
    g = get_graph()
    result = g.query(
        """
        MATCH (d:Developer {username: $username})-[v:VIEWED|BOOKMARKED|SKIPPED|APPLIED_TO]->(i:Issue)
        OPTIONAL MATCH (i)<-[:HAS_ISSUE]-(r:Repository)
        RETURN i.title AS title, i.url AS url,
               r.full_name AS repo,
               type(v) AS action
        ORDER BY v.ts DESC
        LIMIT 30
        """,
        {"username": username},
    )
    rows = []
    for row in result.result_set:
        # positional: title=0, url=1, repo=2, action=3
        action = (row[3] or "viewed").lower().replace("applied_to", "applied")
        rows.append({
            "title": row[0],
            "url": row[1],
            "repo": row[2],
            "action": action,
        })
    return rows


def query_repo_health(repo_full_name: str) -> dict:
    g = get_graph()
    result = g.query(
        """
        MATCH (r:Repository {full_name: $repo})-[:MAINTAINED_BY]->(m:Maintainer)
        OPTIONAL MATCH (r)-[:HAS_ISSUE]->(i:Issue)
        WITH r, m,
             count(i) AS total_issues,
             count(CASE WHEN i.state = 'open' THEN 1 END) AS open_issues
        RETURN r.full_name AS full_name, r.stars AS stars,
               m.username AS maintainer, m.avg_response_days AS avg_response_days,
               m.is_active AS is_active,
               total_issues, open_issues,
               r.last_commit_days_ago AS days_since_last_commit
        """,
        {"repo": repo_full_name},
    )
    if result.result_set:
        return _row_to_dict(result.header, result.result_set[0])
    return {}


def write_session_action(username: str, issue_id: str, action: str, session_id: str, reason: str = None):
    g = get_graph()
    rel_type = action.upper()
    props = "ts: timestamp(), session_id: $session_id"
    params = {"username": username, "issue_id": issue_id, "session_id": session_id}
    if reason:
        props += ", reason: $reason"
        params["reason"] = reason
    g.query(
        f"""
        MATCH (d:Developer {{username: $username}})
        MERGE (i:Issue {{id: $issue_id}})
        CREATE (d)-[:{rel_type} {{{props}}}]->(i)
        """,
        params,
    )
