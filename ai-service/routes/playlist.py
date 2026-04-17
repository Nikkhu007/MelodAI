"""POST /generate-playlist — Coherent playlist generation."""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional, Dict

router = APIRouter()

class AIProfile(BaseModel):
    genre_weights: Dict[str, float] = {}
    mood_weights:  Dict[str, float] = {}

class PlaylistRequest(BaseModel):
    user_id:    str
    mood:       Optional[str] = None
    ai_profile: AIProfile
    limit:      int = 20

@router.post("")
async def generate_playlist(req: PlaylistRequest, request: Request):
    engine = request.app.state.engine

    song_ids, reason = engine.generate_playlist(
        user_id    = req.user_id,
        mood       = req.mood,
        ai_profile = req.ai_profile.dict(),
        limit      = req.limit,
    )

    # Fallback
    if not song_ids and engine.db:
        q = {"isPublic": True}
        if req.mood:
            q["mood"] = req.mood
        docs     = list(engine.db.songs.find(q, {"_id": 1}).sort("plays", -1).limit(req.limit))
        song_ids = [str(d["_id"]) for d in docs]
        reason   = f"Trending {req.mood or 'songs'}"

    return {
        "song_ids": song_ids,
        "reason":   reason,
        "count":    len(song_ids),
    }
