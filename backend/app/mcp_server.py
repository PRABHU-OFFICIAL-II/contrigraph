"""
MCP server — exposes all 9 ContriGraph tools to the Claude agent.
Run standalone: python -m app.mcp_server
"""

import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from app import graph as g
from app import github_ingestion as ingestion

server = Server("contrigraph")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="ingest_developer",
            description="Fetch a developer's GitHub profile, repos, skills, and social connections and store everything in FalkorDB.",
            inputSchema={
                "type": "object",
                "properties": {
                    "github_username": {"type": "string", "description": "GitHub username to ingest"}
                },
                "required": ["github_username"],
            },
        ),
        Tool(
            name="find_matching_issues",
            description="Multi-hop FalkorDB query: find open issues matching the developer's skills where the maintainer is responsive and friends have contributed. Returns a ranked list.",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {"type": "string"},
                    "max_response_days": {"type": "integer", "default": 7},
                    "complexity": {"type": "string", "enum": ["beginner", "intermediate", "advanced"], "description": "Leave empty for all"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["username"],
            },
        ),
        Tool(
            name="analyse_skill_gaps",
            description="Find which skills a target repo requires that the developer does not yet have. Returns missing skills with categories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {"type": "string"},
                    "repo_full_name": {"type": "string", "description": "e.g. tiangolo/fastapi"},
                },
                "required": ["username", "repo_full_name"],
            },
        ),
        Tool(
            name="find_connection_path",
            description="Run shortest-path in FalkorDB between developer and repo via CONTRIBUTED_TO and FOLLOWS relationships. Shows social proximity.",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {"type": "string"},
                    "repo_full_name": {"type": "string"},
                },
                "required": ["username", "repo_full_name"],
            },
        ),
        Tool(
            name="find_related_repos",
            description="Traverse FalkorDB to find repos related to the developer's skills and similar to repos they already contribute to.",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {"type": "string"},
                    "limit": {"type": "integer", "default": 8},
                },
                "required": ["username"],
            },
        ),
        Tool(
            name="get_repo_health",
            description="Query FalkorDB for maintainer activity, response times, issue close rates, and last commit time for a repo.",
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_full_name": {"type": "string"},
                },
                "required": ["repo_full_name"],
            },
        ),
        Tool(
            name="remember_action",
            description="Write a VIEWED/BOOKMARKED/SKIPPED/APPLIED_TO relationship to FalkorDB — this is the persistent session memory for Track 02.",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {"type": "string"},
                    "issue_id": {"type": "string"},
                    "action": {"type": "string", "enum": ["viewed", "bookmarked", "skipped", "applied"]},
                    "session_id": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["username", "issue_id", "action", "session_id"],
            },
        ),
        Tool(
            name="get_session_history",
            description="Query FalkorDB for all issues the developer viewed, bookmarked, or applied to recently. Used to resume a session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {"type": "string"},
                    "days_back": {"type": "integer", "default": 7},
                },
                "required": ["username"],
            },
        ),
        Tool(
            name="ingest_repo_issues",
            description="Fetch all open 'good first issue' issues for a repo from GitHub and store them as Issue nodes in FalkorDB.",
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_full_name": {"type": "string", "description": "e.g. tiangolo/fastapi"},
                },
                "required": ["repo_full_name"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        result = await _dispatch(name, arguments)
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    except Exception as exc:
        return [TextContent(type="text", text=json.dumps({"error": str(exc)}))]


async def _dispatch(name: str, args: dict):
    if name == "ingest_developer":
        return ingestion.ingest_developer(args["github_username"])

    if name == "find_matching_issues":
        username = args["username"]
        issues = g.query_matching_issues(
            username=username,
            max_response_days=args.get("max_response_days", 7),
            complexity=args.get("complexity"),
            limit=args.get("limit", 10),
        )
        print(f"[find_matching_issues] returned {len(issues)} issues for {username}")

        # If empty, auto-ingest issues for repos matching the user's skills then retry
        if not issues:
            repos_to_ingest = g.get_repos_without_issues(username, limit=5)
            print(f"[find_matching_issues] no issues — auto-ingesting {repos_to_ingest}")
            for repo in repos_to_ingest:
                try:
                    ingestion.ingest_repo_issues(repo)
                except Exception as e:
                    print(f"  ✗ ingest_repo_issues({repo}) failed: {e}")
            # Retry after ingestion
            issues = g.query_matching_issues(
                username=username,
                max_response_days=args.get("max_response_days", 7),
                complexity=args.get("complexity"),
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


async def main():
    async with stdio_server() as streams:
        await server.run(streams[0], streams[1], server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
