"""POST /rank-search — Re-rank search results using BM25 + user taste."""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter()

class AIProfile(BaseModel):
    genre_weights: Dict[str, float] = {}
    mood_weights:  Dict[str, float] = {}

class SearchRankRequest(BaseModel):
    user_id:       str
    query:         str
    candidate_ids: List[str]
    ai_profile:    AIProfile

@router.post("")
async def rank_search(req: SearchRankRequest, request: Request):
    engine = request.app.state.engine
    ranked = engine.rank_search_results(
        user_id       = req.user_id,
        query         = req.query,
        candidate_ids = req.candidate_ids,
        ai_profile    = req.ai_profile.dict(),
    )
    return {"ranked_ids": ranked, "source": "bm25-v2"}
