"""
MelodAI — Python AI Microservice
FastAPI + Scikit-learn hybrid recommendation engine

Architecture:
  1. Content-Based Filtering  — cosine similarity on song feature vectors
  2. Collaborative Filtering  — SVD matrix factorization on user-item interactions
  3. Hybrid Scoring           — weighted blend with behavior + recency boosts
"""

import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes.embed import router as embed_router
from routes.recommend import router as recommend_router
from routes.similar import router as similar_router
from routes.playlist import router as playlist_router
from routes.search import router as search_router
from models.engine import RecommendationEngine

load_dotenv()

# Global engine instance (loaded once at startup)
engine = RecommendationEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models and start background retraining on startup."""
    print("🤖 Initializing AI Recommendation Engine...")
    await engine.initialize()
    print("✅ AI Engine ready")

    # Background periodic retraining
    interval = int(os.getenv("MODEL_RETRAIN_INTERVAL", 3600))
    task = asyncio.create_task(periodic_retrain(engine, interval))

    yield  # App runs here

    task.cancel()
    print("👋 AI Service shutting down")


async def periodic_retrain(engine: RecommendationEngine, interval: int):
    """Retrain collaborative filtering model every N seconds."""
    while True:
        await asyncio.sleep(interval)
        try:
            print("🔄 Retraining collaborative model...")
            await engine.retrain_collaborative()
            print("✅ Model retrained")
        except Exception as e:
            print(f"❌ Retrain failed: {e}")


app = FastAPI(
    title="MelodAI Recommendation Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach engine to app state so routes can access it
app.state.engine = engine

# Register routers
app.include_router(embed_router,      prefix="/embed",            tags=["Embeddings"])
app.include_router(recommend_router,  prefix="/recommend",        tags=["Recommendations"])
app.include_router(similar_router,    prefix="/similar",          tags=["Similarity"])
app.include_router(playlist_router,   prefix="/generate-playlist",tags=["Playlists"])
app.include_router(search_router,     prefix="/rank-search",      tags=["Search"])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "melodai-ai",
        "songs_indexed": engine.get_song_count(),
        "collab_model_ready": engine.collab_ready,
    }


@app.post("/train")
async def trigger_retrain():
    """Manually trigger model retraining."""
    await engine.retrain_collaborative()
    return {"success": True, "message": "Model retrained"}
