# MelodAI — Complete Setup Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.10 |
| MongoDB Atlas | Free tier works |
| Cloudinary | Free tier works |

---

## 1. Clone & Configure

```bash
git clone <your-repo>
cd melodai
```

### Create environment files

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI, JWT secret, Cloudinary keys

# AI Service
cp ai-service/.env.example ai-service/.env
# Edit ai-service/.env with your MongoDB URI

# Frontend
cp frontend/.env.example frontend/.env
# VITE_API_URL=http://localhost:5000/api (default is fine for local dev)
```

---

## 2. Run AI Service (Python)

```bash
cd ai-service
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: http://localhost:8000/health

---

## 3. Run Backend (Node.js)

```bash
cd backend
npm install
# Seed the database with sample songs and users:
npm run seed
# Start development server:
npm run dev
```

Verify: http://localhost:5000/health

**Demo credentials after seed:**
- Admin: `admin@melodai.com` / `admin123`
- User:  `test@melodai.com` / `test123`

---

## 4. Run Frontend (React/Vite)

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## 5. Docker (All Services)

```bash
cp .env.example .env
# Fill in your credentials in .env

docker-compose up --build
```

- Frontend:  http://localhost:5173
- Backend:   http://localhost:5000
- AI Service: http://localhost:8000

---

## Project Structure

```
melodai/
├── frontend/                    # React + Vite PWA
│   ├── src/
│   │   ├── App.jsx              # Router root
│   │   ├── index.css            # Global styles + Tailwind
│   │   ├── components/
│   │   │   ├── layout/          # Layout, Sidebar, TopBar
│   │   │   ├── player/          # Global Player bar
│   │   │   ├── songs/           # SongRow, SongCard, UploadModal
│   │   │   ├── playlists/       # PlaylistCard, modals
│   │   │   └── ui/              # Toast, Skeleton, MoodPicker
│   │   ├── pages/               # Home, Search, Library, Mood…
│   │   ├── store/               # Zustand stores (auth, player, ui)
│   │   └── services/            # Axios API client
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                     # Node.js + Express
│   ├── server.js                # Entry point
│   ├── config/                  # DB + Cloudinary
│   ├── models/                  # User, Song, Playlist, ListenEvent
│   ├── controllers/             # auth, songs, playlists, recommendations
│   ├── routes/                  # REST API routes
│   ├── middleware/              # JWT auth middleware
│   └── utils/seed.js            # Database seeder
│
├── ai-service/                  # Python FastAPI
│   ├── main.py                  # FastAPI app + lifespan
│   ├── models/
│   │   └── engine.py            # Core RecommendationEngine
│   └── routes/
│       ├── embed.py             # POST /embed
│       ├── recommend.py         # POST /recommend
│       ├── similar.py           # POST /similar
│       ├── playlist.py          # POST /generate-playlist
│       └── search.py            # POST /rank-search + /mood-recommend
│
└── docker-compose.yml
```

---

## How the AI Recommendation Engine Works

### 1. Content-Based Filtering (songs → songs)

Every song is represented as a **feature vector** combining:

- **TF-IDF text features** built from genre + mood + tags (e.g., `"electronic chill lofi study beats"`)  → captures semantic similarity
- **Normalized numeric features**: tempo/200, energy, valence, acousticness, danceability

These are concatenated and **L2-normalized** into a single embedding per song. Recommendations use **cosine similarity** between vectors — songs with similar audio characteristics cluster together.

```python
# In engine.py
combined = np.hstack([tfidf_matrix, numeric_features])
self.content_matrix = normalize(combined, norm="l2")
sims = cosine_similarity(query_vec, self.content_matrix)
```

### 2. Collaborative Filtering (users → users)

A **user-item interaction matrix** is built from `ListenEvent` records:
- `play=1`, `complete=2`, `repeat=3`, `like=5`, `skip=-1`

This sparse matrix is decomposed via **Truncated SVD** (k=50 latent factors):

```
user_factors (n_users × k) @ item_factors.T (k × n_songs) = predicted scores
```

Users with similar listening patterns end up with similar latent factors — giving cross-user recommendations even for songs a user hasn't heard.

### 3. Hybrid Scoring

Final recommendation score combines all signals:

```
score = 0.35 × content_similarity
      + 0.40 × collaborative_predicted_score
      + 0.25 × user_profile_preference
      + 0.30 × mood_boost (if current mood matches song mood)
```

The **user profile** (genre/mood weight maps) is updated in real-time on every listen event in Node.js, so recommendations react immediately to behavior.

### 4. Behavior Feedback Loop

Every user action — play, skip, like, repeat, complete — is:
1. Stored in `ListenEvent` (MongoDB)
2. Immediately used to update the user's `aiProfile` (genre/mood weights)
3. Periodically used to retrain the SVD collaborative model (default: every 60 min)

This creates a continuous loop: **listen → learn → recommend better**.

### Cold Start Handling

- **New user**: Falls back to content-only recommendations + trending songs
- **New song**: Gets a content embedding immediately; appears in content-based results before any plays
- **No mood set**: Hybrid model runs without mood boost

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/mood` | Set mood |
| GET | `/api/songs` | Browse songs (filter/paginate) |
| GET | `/api/songs/trending` | Trending songs |
| POST | `/api/songs/:id/event` | Track behavior event |
| GET | `/api/recommendations/home` | AI home feed |
| GET | `/api/recommendations/similar/:id` | Similar songs |
| GET | `/api/recommendations/mood/:mood` | Mood-based |
| GET | `/api/recommendations/search?q=` | AI-ranked search |
| POST | `/api/playlists/ai-generate` | Generate AI playlist |
| POST | `/api/upload/audio` | Upload audio file |
| POST | `/api/upload/image` | Upload cover art |

---

## Environment Variables

### Backend (`backend/.env`)
```
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret
JWT_EXPIRE=7d
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
AI_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
```

### AI Service (`ai-service/.env`)
```
MONGODB_URI=mongodb+srv://...
MODEL_RETRAIN_INTERVAL=3600
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000/api
```
