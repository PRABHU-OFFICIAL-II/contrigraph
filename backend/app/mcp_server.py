"""
ContriGraph tool dispatcher — called directly by agent.py.
"""

import json

from app import graph as g
from app import github_ingestion as ingestion


async def _dispatch(name: str, args: dict):
    if name == "ingest_developer":
        return ingestion.ingest_developer(args["github_username"])

    if name == "find_matching_issues":
        username = args["username"]
        max_days = args.get("max_response_days", 30)
        skill = (args.get("skill") or "").lower() or None
        issues = g.query_matching_issues(
            username=username,
            max_response_days=max_days,
            complexity=args.get("complexity"),
            skill=skill,
            limit=args.get("limit", 10),
        )
        print(f"[find_matching_issues] returned {len(issues)} issues for {username} skill={skill}")

        # If empty, auto-ingest issues for repos matching the skill/user's skills then retry
        if not issues:
            repos_to_ingest = g.get_repos_without_issues(username, limit=5)
            # Fallback: search GitHub dynamically for popular repos in the requested skill
            if not repos_to_ingest and skill:
                repos_to_ingest = ingestion.gh.search_repos_by_skill(skill, limit=3)
                print(f"[find_matching_issues] GitHub search for skill={skill!r}: {repos_to_ingest}")
            # Last resort: fall back to popular Python repos
            if not repos_to_ingest:
                repos_to_ingest = ["psf/requests", "pallets/flask"]
            print(f"[find_matching_issues] no issues — auto-ingesting {repos_to_ingest}")
            for repo in repos_to_ingest:
                try:
                    ingestion.ingest_repo_issues(repo)
                except Exception as e:
                    print(f"  ✗ ingest_repo_issues({repo}) failed: {e}")
            # Retry after ingestion
            issues = g.query_matching_issues(
                username=username,
                max_response_days=max_days,
                complexity=args.get("complexity"),
                skill=skill,
                limit=args.get("limit", 10),
            )
            print(f"[find_matching_issues] after auto-ingest: {len(issues)} issues")

        # Auto-write VIEWED for every returned issue so history is always populated
        session_id = args.get("session_id", f"{username}-auto")
        for issue in issues:
            issue_id = issue.get("issue_id")
            print(f"  → issue_id={issue_id!r} title={issue.get('title','')[:50]}")
            if issue_id:
                try:
                    g.write_session_action(
                        username=username,
                        issue_id=str(issue_id),
                        action="viewed",
                        session_id=session_id,
                    )
                    print(f"  ✓ wrote VIEWED for {issue_id}")
                except Exception as e:
                    print(f"  ✗ write_session_action failed: {e}")
        return issues

    if name == "analyse_skill_gaps":
        return g.query_skill_gaps(args["username"], args["repo_full_name"])

    if name == "find_connection_path":
        return g.query_connection_path(args["username"], args["repo_full_name"])

    if name == "find_related_repos":
        return g.query_related_repos(args["username"], args.get("limit", 8))

    if name == "get_repo_health":
        return g.query_repo_health(args["repo_full_name"])

    if name == "remember_action":
        g.write_session_action(
            username=args["username"],
            issue_id=args["issue_id"],
            action=args["action"],
            session_id=args["session_id"],
            reason=args.get("reason"),
        )
        return {"status": "ok", "action": args["action"], "issue_id": args["issue_id"]}

    if name == "get_session_history":
        return g.query_session_history(args["username"], args.get("days_back", 7))

    if name == "ingest_repo_issues":
        return ingestion.ingest_repo_issues(args["repo_full_name"])

    raise ValueError(f"Unknown tool: {name}")
