"""
Claude agent loop — calls the Salesforce Bedrock proxy directly via httpx.
The proxy expects: POST {BASE_URL}/model/{modelId}/invoke
(standard Anthropic SDK sends /v1/messages which the proxy rejects)
"""

import os
import json
import asyncio
from typing import AsyncGenerator

import httpx

from app.mcp_server import _dispatch

MODEL   = os.getenv("AI_MODEL", "claude-sonnet-4-6")
BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "").rstrip("/")
API_KEY  = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """
You are ContriGraph, an AI agent that helps developers find open source issues to contribute to.
You are backed by a FalkorDB knowledge graph. You MUST query the graph before responding.

MANDATORY TOOL RULES — these are hard rules, never skip them:
1. EVERY time the user asks for issues, repos, or recommendations → call find_matching_issues FIRST.
   Never answer from your own knowledge. Always query FalkorDB first.
2. If find_matching_issues returns an empty list → call ingest_repo_issues for 2-3 relevant repos,
   then call find_matching_issues again.
3. AFTER calling find_matching_issues and getting results → call remember_action with action="viewed"
   for EACH issue_id returned. Do this before writing your final reply.
4. If the user says "bookmark" → call remember_action with action="bookmarked".
5. If the user says "skip" or "not interested" → call remember_action with action="skipped".
6. If the user says "I applied" → call remember_action with action="applied".
7. At the START of every conversation → call get_session_history to resume context.

RESPONSE RULES:
- Only present repos/issues that came from your tool calls. Never invent repos or issues.
- For each result explain the graph path: "You know Python → repo requires Python → issue needs Python"
- Reference maintainer response times, stars, and skill matches from the graph data.
- Keep responses concise and actionable.
""".strip()

TOOLS = [
    {
        "name": "ingest_developer",
        "description": "Fetch a developer's GitHub profile, repos, skills, and social connections and store everything in FalkorDB.",
        "input_schema": {
            "type": "object",
            "properties": {"github_username": {"type": "string"}},
            "required": ["github_username"],
        },
    },
    {
        "name": "find_matching_issues",
        "description": "Multi-hop FalkorDB query: find open issues matching the developer's skills where the maintainer is responsive. Returns ranked list.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "max_response_days": {"type": "integer"},
                "complexity": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["username"],
        },
    },
    {
        "name": "analyse_skill_gaps",
        "description": "Find which skills a target repo requires that the developer does not yet have.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "repo_full_name": {"type": "string"},
            },
            "required": ["username", "repo_full_name"],
        },
    },
    {
        "name": "find_connection_path",
        "description": "Run shortest-path in FalkorDB between developer and repo via CONTRIBUTED_TO and FOLLOWS relationships.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "repo_full_name": {"type": "string"},
            },
            "required": ["username", "repo_full_name"],
        },
    },
    {
        "name": "find_related_repos",
        "description": "Traverse FalkorDB to find repos related to the developer's skills.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["username"],
        },
    },
    {
        "name": "get_repo_health",
        "description": "Query FalkorDB for maintainer activity, response times, and issue close rates for a repo.",
        "input_schema": {
            "type": "object",
            "properties": {"repo_full_name": {"type": "string"}},
            "required": ["repo_full_name"],
        },
    },
    {
        "name": "remember_action",
        "description": "Write a VIEWED/BOOKMARKED/SKIPPED/APPLIED_TO relationship to FalkorDB — persistent session memory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "issue_id": {"type": "string"},
                "action": {"type": "string"},
                "session_id": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["username", "issue_id", "action", "session_id"],
        },
    },
    {
        "name": "get_session_history",
        "description": "Query FalkorDB for all issues the developer viewed, bookmarked, or applied to recently.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "days_back": {"type": "integer"},
            },
            "required": ["username"],
        },
    },
    {
        "name": "ingest_repo_issues",
        "description": "Fetch all open 'good first issue' issues for a repo from GitHub and store them in FalkorDB.",
        "input_schema": {
            "type": "object",
            "properties": {"repo_full_name": {"type": "string"}},
            "required": ["repo_full_name"],
        },
    },
]


def _request_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }


def _call_model_sync(messages: list, system: str, max_tokens: int = 4096) -> dict:
    """
    Call the Salesforce Bedrock proxy directly.
    URL: {BASE_URL}/model/{MODEL}/invoke
    Body: Bedrock-compatible Anthropic format
    """
    url = f"{BASE_URL}/model/{MODEL}/invoke"
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
        "tools": TOOLS,
    }
    resp = httpx.post(url, json=body, headers=_request_headers(), timeout=120.0, verify=False)
    resp.raise_for_status()
    return resp.json()


async def run_agent_stream(
    username: str,
    message: str,
    session_id: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Agentic loop: call the model, handle tool_use, loop until plain text response.
    Yields SSE-formatted chunks.
    """
    # Build a per-request system prompt that always includes the user's identity
    system = (
        SYSTEM_PROMPT
        + f"\n\nThe currently logged-in GitHub user is: @{username}. "
        "Their profile and repositories are already loaded in FalkorDB. "
        "NEVER ask for a GitHub username — always use this username for all tool calls."
        f"\nSession ID: {session_id}"
    )

    messages = list(history or [])
    messages.append({"role": "user", "content": message})

    while True:
        try:
            response = await asyncio.to_thread(_call_model_sync, messages, system)
        except httpx.HTTPStatusError as exc:
            yield f"data: {json.dumps({'type': 'text', 'content': f'Error calling model: {exc.response.text}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'text', 'content': f'Unexpected error: {str(exc)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        content = response.get("content", [])
        stop_reason = response.get("stop_reason", "end_turn")
        tool_use_blocks = [b for b in content if b.get("type") == "tool_use"]

        if not tool_use_blocks or stop_reason == "end_turn":
            for block in content:
                if block.get("type") == "text":
                    text = block.get("text", "")
                    chunk_size = 20
                    for i in range(0, len(text), chunk_size):
                        yield f"data: {json.dumps({'type': 'text', 'content': text[i:i+chunk_size]})}\n\n"
                        await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Notify frontend of tool calls
        for block in tool_use_blocks:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': block['name'], 'input': block['input']})}\n\n"

        # Execute tools
        tool_results = []
        for block in tool_use_blocks:
            try:
                result = await _dispatch(block["name"], block["input"])
            except Exception as exc:
                result = {"error": str(exc)}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": json.dumps(result),
            })

        # Feed assistant turn + tool results back
        messages.append({"role": "assistant", "content": content})
        messages.append({"role": "user", "content": tool_results})
