"""POST /recommend — Hybrid recommendations with session context."""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional, Dict

router = APIRouter()

class AIProfile(BaseModel):
    genre_weights:    Dict[str, float] = {}
    mood_weights:     Dict[str, float] = {}
    tempo_preference: float = 120.0

class RecommendRequest(BaseModel):
    user_id:     str
    ai_profile:  AIProfile
    listened_ids: List[str] = []
    current_mood: Optional[str] = None
    session_ids:  List[str] = []   # songs heard in current session
    limit:        int = 30

@router.post("")
async def recommend(req: RecommendRequest, request: Request):
    engine = request.app.state.engine

    results = engine.hybrid_recommend(
        user_id      = req.user_id,
        ai_profile   = req.ai_profile.dict(),
        listened_ids = req.listened_ids,
        current_mood = req.current_mood,
        limit        = req.limit,
        session_ids  = req.session_ids,
    )

    # Cold start fallback
    if not results and engine.db:
        docs    = list(engine.db.songs.find({"isPublic": True}, {"_id": 1}).sort("plays", -1).limit(req.limit))
        results = [str(d["_id"]) for d in docs]

    return {
        "recommendations": results,
        "source": "ai-hybrid-v2" if engine.collab_ready else "content-v2",
        "count":  len(results),
    }


class MoodRecommendRequest(BaseModel):
    user_id:    str
    mood:       str
    ai_profile: AIProfile
    limit:      int = 20

@router.post("/mood")
async def mood_recommend(req: MoodRecommendRequest, request: Request):
    engine  = request.app.state.engine
    results = engine.mood_recommend(
        user_id    = req.user_id,
        mood       = req.mood,
        ai_profile = req.ai_profile.dict(),
        limit      = req.limit,
    )

    # Fallback
    if not results and engine.db:
        docs    = list(engine.db.songs.find({"mood": req.mood, "isPublic": True}, {"_id": 1}).sort("plays", -1).limit(req.limit))
        results = [str(d["_id"]) for d in docs]

    return {"recommendations": results, "source": "mood-v2"}


class SkipRequest(BaseModel):
    user_id: str
    song_id: str

@router.post("/skip-feedback")
async def skip_feedback(req: SkipRequest, request: Request):
    """Real-time skip recording for immediate personalisation."""
    request.app.state.engine.record_skip(req.user_id, req.song_id)
    return {"success": True}
