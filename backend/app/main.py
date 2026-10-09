import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import developer, search, session, chat, graph, auth

app = FastAPI(title="ContriGraph API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(developer.router, prefix="/api/developer", tags=["developer"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "contrigraph"}


@app.get("/")
def root():
    return {"message": "ContriGraph API — Find your path in open source. One graph at a time."}
