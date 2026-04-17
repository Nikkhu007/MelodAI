"""POST /embed — Generate content embedding for a song."""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter()

class EmbedRequest(BaseModel):
    song_id:  str
    features: Dict = {}

@router.post("")
async def embed(req: EmbedRequest, request: Request):
    engine = request.app.state.engine
    if not engine.song_ids:
        return {"embedding": [], "note": "Model not ready"}
    try:
        vec = engine._embed_features(req.features)
        return {"embedding": vec.tolist(), "song_id": req.song_id}
    except Exception as e:
        return {"embedding": [], "error": str(e)}
