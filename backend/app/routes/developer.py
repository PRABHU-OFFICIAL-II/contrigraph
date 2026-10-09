from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app import github_ingestion as ingestion
from app import graph as g

router = APIRouter()


class IngestRequest(BaseModel):
    github_username: str


@router.post("/ingest")
def ingest_developer(req: IngestRequest):
    result = ingestion.ingest_developer(req.github_username)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{username}")
def get_developer(username: str):
    graph = g.get_graph()
    result = graph.query(
        "MATCH (d:Developer {username: $username}) RETURN d",
        {"username": username},
    )
    if not result.result_set:
        raise HTTPException(status_code=404, detail="Developer not found in graph")
    node = result.result_set[0][0]
    return {"username": username, "properties": node.properties}
