import os
import asyncio

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.github_ingestion import ingest_developer

router = APIRouter()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


@router.get("/github/login")
def github_login():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID not configured")
    params = f"client_id={GITHUB_CLIENT_ID}&scope=read%3Auser%2Cpublic_repo"
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/github/callback")
async def github_callback(code: str):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    # Exchange code for access token
    token_resp = httpx.post(
        "https://github.com/login/oauth/access_token",
        json={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"},
        timeout=30.0,
    )
    token_data = token_resp.json()
    access_token = token_data.get("access_token", "")
    if not access_token:
        raise HTTPException(status_code=400, detail=f"GitHub token exchange failed: {token_data}")

    # Fetch user profile with the OAuth token
    user_resp = httpx.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json",
        },
        timeout=30.0,
    )
    user_data = user_resp.json()
    username = user_data.get("login", "")
    if not username:
        raise HTTPException(status_code=400, detail="Could not get GitHub username from token")

    # Ingest developer into FalkorDB (uses the PAT from env, not OAuth token)
    await asyncio.to_thread(ingest_developer, username)

    return RedirectResponse(f"{FRONTEND_URL}/search/{username}?auth=1")


@router.get("/github/user")
def get_auth_info():
    """Returns whether OAuth is configured so the frontend can show/hide the button."""
    return {"oauth_enabled": bool(GITHUB_CLIENT_ID)}
