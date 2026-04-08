"""
POST /recommend
Main hybrid recommendation endpoint — returns ranked song IDs for a user's home feed.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional, Dict

router = APIRouter()

class AIProfile(BaseModel):
    genre_weights: Dict[str, float] = {}
    mood_weights: Dict[str, float] = {}
    tempo_preference: float = 120.0

class RecommendRequest(BaseModel):
    user_id: str
    ai_profile: AIProfile
    listened_ids: List[str] = []
    current_mood: Optional[str] = None
    limit: int = 30

class RecommendResponse(BaseModel):
    recommendations: List[str]
    source: str = "hybrid"

@router.post("", response_model=RecommendResponse)
async def recommend(req: RecommendRequest, request: Request):
    engine = request.app.state.engine

    results = engine.hybrid_recommend(
        user_id=req.user_id,
        ai_profile=req.ai_profile.dict(),
        listened_ids=req.listened_ids,
        current_mood=req.current_mood,
        limit=req.limit,
    )

    # Cold start: fallback to popular songs from DB
    if not results and engine.db:
        docs = list(engine.db.songs.find(
            {"isPublic": True},
            {"_id": 1}
        ).sort("plays", -1).limit(req.limit))
        results = [str(d["_id"]) for d in docs]

    return RecommendResponse(
        recommendations=results,
        source="hybrid" if engine.collab_ready else "content-only"
    )
