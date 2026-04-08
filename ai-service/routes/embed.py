"""
POST /embed
Generate and return a content feature embedding for a song.
Called by the Node backend after a song is created/updated.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional, Dict

router = APIRouter()

class EmbedRequest(BaseModel):
    song_id: str
    features: Dict

class EmbedResponse(BaseModel):
    song_id: str
    embedding: List[float]

@router.post("", response_model=EmbedResponse)
async def embed_song(req: EmbedRequest, request: Request):
    engine = request.app.state.engine

    if engine.content_matrix is None:
        # Engine not ready (no songs yet) — return zeros
        return EmbedResponse(song_id=req.song_id, embedding=[0.0] * 205)

    emb = engine.get_content_embedding(req.features)
    return EmbedResponse(song_id=req.song_id, embedding=emb.tolist())
