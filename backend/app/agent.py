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
You are ContriGraph. Call find_matching_issues ONCE, then reply.

TOOL RULE: Call find_matching_issues exactly once per user message. Never call get_session_history or remember_action — those are handled automatically.
- If the user asks for a specific language (dart, go, python, typescript, etc.), pass skill= with that language.
- NEVER call ingest_repo_issues directly — find_matching_issues handles ingestion automatically when needed.

RESPONSE FORMAT — output EXACTLY this, nothing else:

1. A GFM table aggregated by repo:

| Repo | Issues Loaded | Avg Maintainer Response |
|---|---|---|
| [owner/repo](https://github.com/owner/repo) | {count} | {response label} |

Rules for this table:
- Each row = one unique repo from the find_matching_issues results
- Issues Loaded = number of issues returned for that repo
- Avg Maintainer Response: use response_days field — if ≤1 day → "⚡ Very Fast (<1 day)", if ≤7 → "{N} days", else → "{N} days"
- Sort by Issues Loaded descending

2. Then on the next line, output exactly 1–2 issue links as top picks (no bullet points, just inline links):
**Top picks:** [issue title](url) · [issue title](url)

THAT IS THE COMPLETE RESPONSE. No other text before, between, or after.
NEVER add: explanations, "Here is", section headers, option menus, or any prose paragraphs.
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
        "description": "Multi-hop FalkorDB query: find open issues matching the developer's skills where the maintainer is responsive. Pass skill= to filter by a specific language (e.g. 'dart', 'go', 'typescript'). Returns ranked list.",
        "input_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "max_response_days": {"type": "integer"},
                "complexity": {"type": "string"},
                "skill": {"type": "string", "description": "Filter by specific skill/language, e.g. 'dart', 'go', 'python'"},
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
]


def _request_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }


def _call_model_sync(messages: list, system: str, max_tokens: int = 1024, force_tool: bool = False) -> dict:
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
    if force_tool:
        body["tool_choice"] = {"type": "any"}
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

    first_call = True
    while True:
        try:
            response = await asyncio.to_thread(_call_model_sync, messages, system, force_tool=first_call)
            first_call = False
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

        if stop_reason == "end_turn" or not tool_use_blocks:
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

        # Execute tools in parallel
        async def _run(block):
            try:
                return await _dispatch(block["name"], block["input"])
            except Exception as exc:
                return {"error": str(exc)}

        results = await asyncio.gather(*[_run(b) for b in tool_use_blocks])
        tool_results = [
            {
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": json.dumps(result),
            }
            for block, result in zip(tool_use_blocks, results)
        ]

        # Feed assistant turn + tool results back
        messages.append({"role": "assistant", "content": content})
        messages.append({"role": "user", "content": tool_results})
