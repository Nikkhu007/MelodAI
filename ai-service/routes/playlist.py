"""
POST /generate-playlist
AI generates a playlist for a user based on mood + profile.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional, Dict
from bson import ObjectId

router = APIRouter()

MOOD_PROFILES = {
    "happy":     {"moods": ["happy"],              "energy_min": 0.6, "valence_min": 0.7},
    "sad":       {"moods": ["sad"],                "energy_max": 0.4, "valence_max": 0.4},
    "energetic": {"moods": ["energetic", "gym"],   "energy_min": 0.8},
    "focus":     {"moods": ["focus"],              "energy_min": 0.2, "energy_max": 0.6},
    "chill":     {"moods": ["chill"],              "energy_max": 0.5},
    "gym":       {"moods": ["gym", "energetic"],   "energy_min": 0.85, "tempo_min": 130},
    "romance":   {"moods": ["romance", "chill"],   "valence_min": 0.5, "energy_max": 0.6},
}

MOOD_REASONS = {
    "happy":     "High-energy, feel-good tracks matched to your happy mood",
    "sad":       "Mellow, introspective songs for a reflective moment",
    "energetic": "High-BPM bangers to match your energy",
    "focus":     "Low-distraction, ambient-leaning tracks to help you concentrate",
    "chill":     "Relaxed vibes, easy listening for unwinding",
    "gym":       "Maximum BPM and energy to push your limits",
    "romance":   "Smooth, warm tracks for a romantic atmosphere",
}

class AIProfile(BaseModel):
    genre_weights: Dict[str, float] = {}
    mood_weights: Dict[str, float] = {}

class PlaylistRequest(BaseModel):
    user_id: str
    mood: Optional[str] = None
    ai_profile: AIProfile
    limit: int = 20

class PlaylistResponse(BaseModel):
    song_ids: List[str]
    reason: str

@router.post("", response_model=PlaylistResponse)
async def generate_playlist(req: PlaylistRequest, request: Request):
    engine = request.app.state.engine
    mood = req.mood or "chill"
    profile = MOOD_PROFILES.get(mood, MOOD_PROFILES["chill"])

    song_ids = []

    if engine.db:
        # Build MongoDB filter from mood profile
        mongo_filter = {"isPublic": True, "mood": {"$in": profile["moods"]}}
        if "energy_min" in profile:
            mongo_filter.setdefault("energy", {})["$gte"] = profile["energy_min"]
        if "energy_max" in profile:
            mongo_filter.setdefault("energy", {})["$lte"] = profile["energy_max"]
        if "valence_min" in profile:
            mongo_filter.setdefault("valence", {})["$gte"] = profile["valence_min"]
        if "valence_max" in profile:
            mongo_filter.setdefault("valence", {})["$lte"] = profile["valence_max"]
        if "tempo_min" in profile:
            mongo_filter.setdefault("tempo", {})["$gte"] = profile["tempo_min"]

        candidates = list(engine.db.songs.find(mongo_filter, {"_id": 1, "genre": 1}).limit(100))

        if candidates:
            # Re-rank by user's genre preferences
            genre_weights = req.ai_profile.genre_weights
            def score_song(s):
                return genre_weights.get(s.get("genre", ""), 0)

            candidates.sort(key=score_song, reverse=True)
            song_ids = [str(c["_id"]) for c in candidates[:req.limit]]

    # Further re-rank with hybrid model if content matrix available
    if song_ids and engine.content_matrix:
        hybrid = engine.hybrid_recommend(
            user_id=req.user_id,
            ai_profile=req.ai_profile.dict(),
            listened_ids=[],
            current_mood=mood,
            limit=req.limit,
        )
        # Intersect: prefer songs that appear in both
        hybrid_set = set(hybrid)
        prioritized = [s for s in song_ids if s in hybrid_set]
        rest = [s for s in song_ids if s not in hybrid_set]
        song_ids = (prioritized + rest)[:req.limit]

    reason = MOOD_REASONS.get(mood, f"Songs curated for your {mood} mood")

    # Enhance reason with top genre if available
    top_genre = max(req.ai_profile.genre_weights.items(), key=lambda x: x[1], default=(None, 0))
    if top_genre[0]:
        reason += f", featuring your favourite {top_genre[0]} tracks"

    return PlaylistResponse(song_ids=song_ids, reason=reason)
