"""
POST /similar
Content-based similarity: return songs most similar to a given song.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter()

class SimilarRequest(BaseModel):
    song_id: str
    features: Dict
    limit: int = 10

class SimilarResponse(BaseModel):
    similar: List[str]

@router.post("", response_model=SimilarResponse)
async def find_similar(req: SimilarRequest, request: Request):
    engine = request.app.state.engine
    results = engine.find_similar_songs(req.song_id, req.features, req.limit)
    return SimilarResponse(similar=results)
