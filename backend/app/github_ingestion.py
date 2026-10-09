"""
Fetch GitHub data for a user and seed all nodes + relationships into FalkorDB.
Entry point: ingest_developer(username)
"""

from app import graph as g
from app import github_client as gh

SKILL_CATEGORIES = {
    "python": "language", "javascript": "language", "typescript": "language",
    "java": "language", "go": "language", "rust": "language", "ruby": "language",
    "php": "language", "swift": "language", "kotlin": "language", "c": "language",
    "cpp": "language", "c#": "language", "shell": "language", "html": "language",
    "css": "language",
    "react": "framework", "vue": "framework", "angular": "framework",
    "fastapi": "framework", "django": "framework", "flask": "framework",
    "express": "framework", "nextjs": "framework", "spring": "framework",
    "docker": "devops", "kubernetes": "devops",
    "postgresql": "database", "mysql": "database", "mongodb": "database",
    "redis": "database", "graphql": "api",
    "tensorflow": "ml", "pytorch": "ml",
}


def _skill_category(name: str) -> str:
    return SKILL_CATEGORIES.get(name.lower(), "other")


def ingest_developer(username: str) -> dict:
    """
    Ingest a GitHub user into FalkorDB:
    - Developer node
    - Skill nodes + HAS_SKILL relationships (from their repo languages)
    - Repository nodes + CONTRIBUTED_TO relationships
    - Following Developer nodes + FOLLOWS relationships
    Returns a summary dict.
    """
    print(f"[ingest] Fetching GitHub profile for {username}...")
    user = gh.get_user(username)
    if not user:
        return {"error": f"GitHub user '{username}' not found"}

    g.upsert_developer({
        "username": user["login"],
        "name": user.get("name") or "",
        "bio": user.get("bio") or "",
        "followers": user.get("followers", 0),
        "github_url": user.get("html_url", ""),
        "location": user.get("location") or "",
    })

    repos = gh.get_user_repos(username)
    print(f"[ingest] Found {len(repos)} repos for {username}")

    skill_set: set[str] = set()
    repos_ingested = 0

    for repo in repos:
        full_name = repo["full_name"]
        owner, repo_name = full_name.split("/", 1)

        last_push_days = gh.days_since(repo.get("pushed_at"))
        g.upsert_repository({
            "full_name": full_name,
            "name": repo["name"],
            "description": repo.get("description") or "",
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "primary_language": repo.get("language") or "",
            "open_issues_count": repo.get("open_issues_count", 0),
            "last_commit_days_ago": last_push_days,
        })

        g.link_developer_repo(username, full_name)

        skills = gh.infer_skills_from_repo(repo)
        for skill in skills:
            cat = _skill_category(skill)
            g.upsert_skill(skill, cat)
            g.link_developer_skill(username, skill)
            g.link_repo_skill(full_name, skill)
            skill_set.add(skill)

        topics = gh.get_repo_topics(owner, repo_name)
        for topic in topics:
            g.upsert_topic(topic)
            g.link_repo_topic(full_name, topic)

        repos_ingested += 1

    following = gh.get_user_following(username)
    print(f"[ingest] Found {len(following)} following for {username}")

    following_ingested = 0
    for followed_user in following:
        followee = followed_user["login"]
        g.upsert_developer({
            "username": followee,
            "name": followed_user.get("name") or "",
            "bio": "",
            "followers": 0,
            "github_url": followed_user.get("html_url", ""),
            "location": "",
        })
        g.link_developer_follows(username, followee)
        following_ingested += 1

    print(f"[ingest] Done for {username}")
    return {
        "username": username,
        "repos_ingested": repos_ingested,
        "skills_found": sorted(skill_set),
        "following_ingested": following_ingested,
    }


def ingest_repo_issues(repo_full_name: str) -> dict:
    """
    Fetch open 'good first issue' issues for a repo, classify them,
    create Issue nodes, Maintainer node, and all relationships in FalkorDB.
    """
    owner, repo_name = repo_full_name.split("/", 1)

    print(f"[ingest] Fetching issues for {repo_full_name}...")
    issues = gh.get_repo_issues(owner, repo_name)

    avg_response = gh.estimate_maintainer_response_days(owner, repo_name)
    user_data = gh.get_user(owner)
    maintainer_data = {
        "username": owner,
        "name": (user_data or {}).get("name") or owner,
        "avg_response_days": avg_response,
        "total_issues_closed": 0,
        "is_active": avg_response < 30,
    }
    g.upsert_maintainer(maintainer_data)
    g.link_repo_maintainer(repo_full_name, owner)

    issues_ingested = 0
    for issue in issues:
        if issue.get("pull_request"):
            continue

        issue_id = f"{repo_name}_{issue['number']}"
        label_names = [l["name"] for l in issue.get("labels", [])]
        complexity = gh.classify_issue_complexity(issue)

        g.upsert_issue({
            "id": issue_id,
            "number": issue["number"],
            "title": issue["title"],
            "body": (issue.get("body") or "")[:1000],
            "labels": label_names,
            "state": issue["state"],
            "complexity": complexity,
            "comments": issue.get("comments", 0),
            "url": issue["html_url"],
        })
        g.link_repo_issue(repo_full_name, issue_id)

        lang = repo_full_name.split("/")[0]
        repo_node = g.get_graph().query(
            "MATCH (r:Repository {full_name: $fn}) RETURN r.primary_language",
            {"fn": repo_full_name},
        )
        if repo_node.result_set:
            lang = (repo_node.result_set[0][0] or "").lower()

        if lang:
            g.upsert_skill(lang, _skill_category(lang))
            g.link_issue_skill(issue_id, lang)

        issues_ingested += 1

    print(f"[ingest] Ingested {issues_ingested} issues for {repo_full_name}")
    return {
        "repo": repo_full_name,
        "issues_ingested": issues_ingested,
        "maintainer": owner,
        "avg_response_days": avg_response,
    }
