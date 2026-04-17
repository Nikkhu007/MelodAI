"""POST /similar — Content-based similar songs."""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter()

class SimilarRequest(BaseModel):
    song_id:  str
    features: Dict = {}
    limit:    int = 10

@router.post("")
async def get_similar(req: SimilarRequest, request: Request):
    engine = request.app.state.engine
    results = engine.find_similar_songs(
        song_id  = req.song_id,
        features = req.features,
        limit    = req.limit,
    )
    return {"similar": results, "count": len(results)}
