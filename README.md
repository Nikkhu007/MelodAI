# MelodAI — AI-Powered Music Streaming

MelodAI is a full-stack AI-first music streaming application where every experience is personalized through machine learning.

## Architecture

```
melodai/
├── frontend/          # React + Vite + Tailwind (PWA)
├── backend/           # Node.js + Express + MongoDB
└── ai-service/        # Python FastAPI + Scikit-learn
```

## Quick Start

```bash
# 1. Start AI Service
cd ai-service && pip install -r requirements.txt && uvicorn main:app --port 8000

# 2. Start Backend
cd backend && npm install && npm run dev

# 3. Start Frontend
cd frontend && npm install && npm run dev
```

## AI Architecture

The recommendation engine uses a **hybrid model**:
1. **Content-based filtering** — cosine similarity on TF-IDF song feature vectors (genre, mood, tempo, tags)
2. **Collaborative filtering** — user-item matrix factorization (SVD)
3. **Hybrid scoring** — weighted blend of both + recency/behavior boost

User listening events (plays, skips, likes, repeats) continuously update their preference profile, which re-ranks recommendations in real time.
