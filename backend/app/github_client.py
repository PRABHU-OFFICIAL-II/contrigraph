import os
import requests
from datetime import datetime, timezone

BASE_URL = "https://api.github.com"

def _headers():
    token = os.getenv("GITHUB_TOKEN")
    h = {"Accept": "application/vnd.github.v3+json"}
    if token:
        h["Authorization"] = f"token {token}"
    return h


def _get(path: str, params: dict = None) -> dict | list | None:
    resp = requests.get(f"{BASE_URL}{path}", headers=_headers(), params=params, timeout=15)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def get_user(username: str) -> dict | None:
    return _get(f"/users/{username}")


def get_user_repos(username: str) -> list:
    return _get(f"/users/{username}/repos", {"per_page": 100, "sort": "pushed"}) or []


def get_user_following(username: str) -> list:
    return _get(f"/users/{username}/following", {"per_page": 100}) or []


def get_repo_topics(owner: str, repo: str) -> list[str]:
    resp = requests.get(
        f"{BASE_URL}/repos/{owner}/{repo}/topics",
        headers={**_headers(), "Accept": "application/vnd.github.mercy-preview+json"},
        timeout=15,
    )
    if resp.status_code != 200:
        return []
    return resp.json().get("names", [])


def get_repo_issues(owner: str, repo: str, label: str = "good first issue", per_page: int = 50) -> list:
    return _get(
        f"/repos/{owner}/{repo}/issues",
        {"labels": label, "state": "open", "per_page": per_page},
    ) or []


def get_issue_comments(owner: str, repo: str, issue_number: int) -> list:
    return _get(f"/repos/{owner}/{repo}/issues/{issue_number}/comments") or []


def get_repo_contributors(owner: str, repo: str) -> list:
    return _get(f"/repos/{owner}/{repo}/contributors", {"per_page": 50}) or []


def days_since(iso_timestamp: str) -> int:
    if not iso_timestamp:
        return 999
    dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).days


def estimate_maintainer_response_days(owner: str, repo: str, sample_issues: int = 10) -> float:
    """Sample closed issues and compute average time to first maintainer comment."""
    resp = requests.get(
        f"{BASE_URL}/repos/{owner}/{repo}/issues",
        headers=_headers(),
        params={"state": "closed", "per_page": sample_issues},
        timeout=15,
    )
    if resp.status_code != 200:
        return 7.0

    issues = resp.json()
    delays = []
    for issue in issues:
        if issue.get("pull_request"):
            continue
        comments = get_issue_comments(owner, repo, issue["number"])
        if comments:
            issue_created = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
            first_comment = datetime.fromisoformat(comments[0]["created_at"].replace("Z", "+00:00"))
            delay = (first_comment - issue_created).total_seconds() / 86400
            if 0 <= delay <= 365:
                delays.append(delay)

    return round(sum(delays) / len(delays), 1) if delays else 7.0


def infer_skills_from_repo(repo_data: dict) -> list[str]:
    """Return a list of skill names based on repo language, topics, and name."""
    skills = set()
    lang = (repo_data.get("language") or "").lower()
    if lang:
        skills.add(lang)

    name = (repo_data.get("name") or "").lower()
    description = (repo_data.get("description") or "").lower()

    keyword_map = {
        "react": "react", "vue": "vue", "angular": "angular",
        "fastapi": "fastapi", "django": "django", "flask": "flask",
        "express": "express", "nextjs": "nextjs", "next.js": "nextjs",
        "docker": "docker", "kubernetes": "kubernetes", "k8s": "kubernetes",
        "graphql": "graphql", "postgres": "postgresql", "postgresql": "postgresql",
        "redis": "redis", "mongodb": "mongodb", "mysql": "mysql",
        "tensorflow": "tensorflow", "pytorch": "pytorch",
        "typescript": "typescript", "javascript": "javascript",
        "rust": "rust", "go": "go", "java": "java", "kotlin": "kotlin",
        "swift": "swift", "ruby": "ruby", "php": "php",
    }
    combined = f"{name} {description}"
    for keyword, skill in keyword_map.items():
        if keyword in combined:
            skills.add(skill)

    return list(skills)


def classify_issue_complexity(issue: dict) -> str:
    labels = [l["name"].lower() for l in issue.get("labels", [])]
    if any(x in labels for x in ["good first issue", "beginner", "easy", "starter"]):
        return "beginner"
    if any(x in labels for x in ["help wanted", "medium", "moderate"]):
        return "intermediate"
    if any(x in labels for x in ["hard", "complex", "expert", "advanced"]):
        return "advanced"
    body_len = len(issue.get("body") or "")
    if body_len < 200:
        return "beginner"
    if body_len < 800:
        return "intermediate"
    return "advanced"
