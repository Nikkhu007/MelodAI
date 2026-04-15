"""
MelodAI — FastAPI AI service entry point
  POST /recommend         — hybrid home-feed recommendations
  POST /embed             — generate song content embedding
  POST /similar           — content-based similar songs
  POST /generate-playlist — AI-curated mood playlist
  POST /mood-recommend    — mood-specific recommendations
  POST /rank-search       — re-rank text search results
  GET  /health            — service health check
"""

from contextlib import asynccontextmanager
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from models.engine import RecommendationEngine
from routes import recommend, embed, similar, playlist, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to MongoDB and initialise the recommendation engine."""
    mongodb_uri = os.getenv("MONGODB_URI")
    engine = RecommendationEngine(mongodb_uri=mongodb_uri)
    app.state.engine = engine
    print(
        f"🎵 MelodAI AI service ready — "
        f"songs: {len(engine.song_ids)}, "
        f"collab: {engine.collab_ready}, "
        f"db: {engine.db is not None}"
    )
    yield
    # Shutdown — nothing to clean up


app = FastAPI(
    title="MelodAI AI Service",
    description="Hybrid recommendation engine for MelodAI",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow requests from the Node backend and the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:5173",
        os.getenv("CLIENT_URL", ""),
        os.getenv("BACKEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(recommend.router, prefix="/recommend",         tags=["recommend"])
app.include_router(embed.router,     prefix="/embed",             tags=["embed"])
app.include_router(similar.router,   prefix="/similar",           tags=["similar"])
app.include_router(playlist.router,  prefix="/generate-playlist", tags=["playlist"])
app.include_router(search.router,                                  tags=["search"])


@app.get("/", tags=["root"])
async def root():
    return {"message": "MelodAI AI service is running 🎵"}


@app.get("/health", tags=["root"])
async def health():
    engine: RecommendationEngine = app.state.engine
    return {
        "status":        "ok",
        "db_connected":  engine.db is not None,
        "songs_indexed": len(engine.song_ids),
        "collab_ready":  engine.collab_ready,
    }
