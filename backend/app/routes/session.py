from fastapi import APIRouter, Query
from pydantic import BaseModel
from app import graph as g

router = APIRouter()


class ActionRequest(BaseModel):
    issue_id: str
    action: str  # viewed | bookmarked | skipped | applied
    session_id: str
    reason: str = None


@router.get("/{username}")
def get_session_history(username: str, days_back: int = Query(7)):
    return g.query_session_history(username, days_back)


@router.post("/{username}/action")
def record_action(username: str, req: ActionRequest):
    g.write_session_action(
        username=username,
        issue_id=req.issue_id,
        action=req.action,
        session_id=req.session_id,
        reason=req.reason,
    )
    return {"status": "ok"}
