from fastapi import APIRouter, Query
from app import graph as g

router = APIRouter()


@router.get("/issues")
def search_issues(
    username: str = Query(...),
    max_response_days: int = Query(7),
    complexity: str = Query(None),
    limit: int = Query(10),
):
    return g.query_matching_issues(username, max_response_days, complexity, limit)


@router.get("/related-repos")
def related_repos(username: str = Query(...), limit: int = Query(8)):
    return g.query_related_repos(username, limit)


@router.get("/repo-health")
def repo_health(repo: str = Query(...)):
    return g.query_repo_health(repo)


@router.get("/skill-gaps")
def skill_gaps(username: str = Query(...), repo: str = Query(...)):
    return g.query_skill_gaps(username, repo)


@router.get("/connection-path")
def connection_path(username: str = Query(...), repo: str = Query(...)):
    return g.query_connection_path(username, repo)
