from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent import run_agent_stream

router = APIRouter()


class ChatRequest(BaseModel):
    username: str
    message: str
    session_id: str = "default"
    history: list[dict] = []


@router.post("")
async def chat(req: ChatRequest):
    return StreamingResponse(
        run_agent_stream(
            username=req.username,
            message=req.message,
            session_id=req.session_id,
            history=req.history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
