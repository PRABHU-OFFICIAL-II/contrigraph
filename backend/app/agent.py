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
You are ContriGraph, an AI agent that helps developers find their perfect open source contribution path.

You have access to a FalkorDB knowledge graph that contains:
- Developer profiles with their skills and contribution history
- GitHub repositories with their issues, topics, and health data
- Maintainer activity and response time data
- Social connections between developers
- The developer's session memory — what they explored before

Your job is to:
1. Understand what the developer is looking for (skill level, interest area, time availability)
2. Use your FalkorDB tools to traverse the graph and find the best matching issues
3. Explain WHY each recommendation matches them — reference the graph path
4. Remember what they explore, bookmark, and skip across sessions
5. Help them understand skill gaps and learning paths

Always explain your reasoning by referencing the graph connections:
- "I found this issue because you know Python, and this repo requires Python"
- "The maintainer responds in an average of 2 days based on past issues in the graph"
- "You are 2 hops from this repo: you follow @bob who contributed to it"

Be specific, be traceable. Every recommendation should come with a graph-backed reason.
Keep responses concise and actionable.
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


def _call_model_sync(messages: list, max_tokens: int = 4096) -> dict:
    """
    Call the Salesforce Bedrock proxy directly.
    URL: {BASE_URL}/model/{MODEL}/invoke
    Body: Bedrock-compatible Anthropic format
    """
    url = f"{BASE_URL}/model/{MODEL}/invoke"
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": SYSTEM_PROMPT,
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
    messages = list(history or [])
    messages.append({"role": "user", "content": message})

    while True:
        try:
            response = await asyncio.to_thread(_call_model_sync, messages)
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
