"""
POST /mood-recommend  — mood-specific recommendations
POST /rank-search     — re-rank text search results using AI
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional, Dict
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

router = APIRouter()

# ── Mood Recommendations ──────────────────────────────────────────────────────

class MoodRecommendRequest(BaseModel):
    user_id: str
    mood: str
    ai_profile: Dict
    limit: int = 20

class MoodRecommendResponse(BaseModel):
    recommendations: List[str]

@router.post("/mood-recommend", response_model=MoodRecommendResponse)
async def mood_recommend(req: MoodRecommendRequest, request: Request):
    engine = request.app.state.engine

    # Use hybrid engine with forced mood filter
    results = engine.hybrid_recommend(
        user_id=req.user_id,
        ai_profile=req.ai_profile,
        listened_ids=[],
        current_mood=req.mood,
        limit=req.limit * 2,  # over-fetch then filter
    )

    # Filter to only songs matching the requested mood (if DB available)
    if engine.db and results:
        from bson import ObjectId
        valid_ids = [r for r in results if len(r) == 24]
        docs = list(engine.db.songs.find(
            {"_id": {"$in": [ObjectId(r) for r in valid_ids]}, "mood": req.mood},
            {"_id": 1}
        ))
        mood_ids = {str(d["_id"]) for d in docs}
        filtered = [r for r in results if r in mood_ids]

        # If not enough mood matches, pad with unfiltered
        if len(filtered) < req.limit:
            extras = [r for r in results if r not in mood_ids]
            filtered = (filtered + extras)[:req.limit]
        results = filtered[:req.limit]

    return MoodRecommendResponse(recommendations=results[:req.limit])


# ── Search Re-Ranking ─────────────────────────────────────────────────────────

class SearchRankRequest(BaseModel):
    user_id: str
    query: str
    candidate_ids: List[str]
    ai_profile: Dict

class SearchRankResponse(BaseModel):
    ranked_ids: List[str]

@router.post("/rank-search", response_model=SearchRankResponse)
async def rank_search(req: SearchRankRequest, request: Request):
    """
    Re-rank text search results using a blend of:
      - User preference score (genre/mood weights)
      - Content similarity to user's listening history
    """
    engine = request.app.state.engine

    if not engine.song_ids or not engine.content_matrix is not None:
        return SearchRankResponse(ranked_ids=req.candidate_ids)

    genre_weights = req.ai_profile.get("genre_weights", {})
    mood_weights = req.ai_profile.get("mood_weights", {})
    total = (sum(genre_weights.values()) + sum(mood_weights.values())) or 1.0

    scored = []
    for sid in req.candidate_ids:
        preference_score = 0.0
        if engine.db:
            try:
                from bson import ObjectId
                doc = engine.db.songs.find_one({"_id": ObjectId(sid)}, {"genre": 1, "mood": 1})
                if doc:
                    preference_score = (
                        genre_weights.get(doc.get("genre", ""), 0) +
                        mood_weights.get(doc.get("mood", ""), 0)
                    ) / total
            except Exception:
                pass

        # Position score: higher = appeared earlier in text search
        position_score = 1.0 - (req.candidate_ids.index(sid) / len(req.candidate_ids))

        # Collaborative score
        collab = engine.get_collaborative_scores(req.user_id)
        collab_score = collab.get(sid, 0.0)

        final = 0.4 * position_score + 0.35 * preference_score + 0.25 * collab_score
        scored.append((sid, final))

    scored.sort(key=lambda x: x[1], reverse=True)
    return SearchRankResponse(ranked_ids=[s for s, _ in scored])
