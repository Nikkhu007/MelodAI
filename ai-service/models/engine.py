"""
RecommendationEngine — Core AI model manager

Responsibilities:
  - Build & query TF-IDF content-based song vectors
  - Train & query SVD collaborative filtering model
  - Provide hybrid scoring combining both
  - Connect to MongoDB to read songs and listen events
"""

import os
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MinMaxScaler, normalize
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from scipy.sparse import csr_matrix
import joblib
from pymongo import MongoClient
from bson import ObjectId
from typing import List, Dict, Optional
import asyncio


class RecommendationEngine:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db = None

        # Content-based components
        self.song_ids: List[str] = []          # ordered list of song _id strings
        self.content_matrix = None              # (n_songs, n_features) normalized numpy array
        self.tfidf_vectorizer = TfidfVectorizer(max_features=200, ngram_range=(1, 2))
        self.scaler = MinMaxScaler()

        # Collaborative filtering components
        self.svd_model: Optional[TruncatedSVD] = None
        self.user_factors = None               # (n_users, k) latent factors
        self.item_factors = None               # (n_songs, k) latent factors
        self.user_ids: List[str] = []
        self.collab_song_ids: List[str] = []
        self.collab_ready = False

    async def initialize(self):
        """Connect to MongoDB and build initial models."""
        mongo_uri = os.getenv("MONGODB_URI")
        if not mongo_uri:
            print("⚠️  No MONGODB_URI — running in demo mode")
            return

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._connect_and_build)

    def _connect_and_build(self):
        """Synchronous init (run in thread pool)."""
        self.client = MongoClient(os.getenv("MONGODB_URI"))
        self.db = self.client["melodai"]
        self.build_content_model()
        self.build_collaborative_model()

    # ─────────────────────────────────────────────
    # CONTENT-BASED MODEL
    # ─────────────────────────────────────────────

    def build_content_model(self):
        """
        Build TF-IDF + numeric feature matrix for all songs.

        Feature vector per song:
          - TF-IDF on (genre + mood + tags) text blob     → sparse semantic features
          - Normalized numeric: tempo, energy, valence,
            acousticness, danceability                    → dense audio features
          Concatenated and L2-normalized.
        """
        if not self.db:
            return

        songs = list(self.db.songs.find(
            {"isPublic": True},
            {"_id": 1, "genre": 1, "mood": 1, "tags": 1,
             "tempo": 1, "energy": 1, "valence": 1,
             "acousticness": 1, "danceability": 1}
        ))

        if not songs:
            print("⚠️  No songs found for content model")
            return

        self.song_ids = [str(s["_id"]) for s in songs]

        # --- Text features (TF-IDF) ---
        text_docs = []
        for s in songs:
            tags = " ".join(s.get("tags", []))
            doc = f"{s.get('genre', '')} {s.get('mood', '')} {tags}"
            text_docs.append(doc.strip() or "unknown")

        tfidf_matrix = self.tfidf_vectorizer.fit_transform(text_docs).toarray()

        # --- Numeric audio features ---
        numeric = np.array([[
            s.get("tempo", 120) / 200.0,           # normalize BPM to 0-1
            s.get("energy", 0.5),
            s.get("valence", 0.5),
            s.get("acousticness", 0.5),
            s.get("danceability", 0.5),
        ] for s in songs], dtype=np.float32)

        # --- Concatenate & L2-normalize ---
        combined = np.hstack([tfidf_matrix, numeric])
        self.content_matrix = normalize(combined, norm="l2")

        print(f"✅ Content model built: {len(self.song_ids)} songs, {self.content_matrix.shape[1]} features")

    def get_content_embedding(self, features: Dict) -> np.ndarray:
        """
        Generate a normalized feature vector for a single song (used for /embed endpoint).
        Uses the fitted TF-IDF vocabulary.
        """
        tags = " ".join(features.get("tags", []))
        doc = f"{features.get('genre', '')} {features.get('mood', '')} {tags}"
        tfidf_vec = self.tfidf_vectorizer.transform([doc]).toarray()

        numeric = np.array([[
            features.get("tempo", 120) / 200.0,
            features.get("energy", 0.5),
            features.get("valence", 0.5),
            features.get("acousticness", 0.5),
            features.get("danceability", 0.5),
        ]], dtype=np.float32)

        combined = np.hstack([tfidf_vec, numeric])
        return normalize(combined, norm="l2")[0]

    def find_similar_songs(self, song_id: str, features: Dict, limit: int = 10) -> List[str]:
        """
        Content-based: return top-N most similar song IDs using cosine similarity.
        If the song is already indexed, use precomputed matrix row.
        Otherwise, generate embedding on the fly.
        """
        if self.content_matrix is None or not self.song_ids:
            return []

        if song_id in self.song_ids:
            idx = self.song_ids.index(song_id)
            query_vec = self.content_matrix[idx].reshape(1, -1)
        else:
            emb = self.get_content_embedding(features)
            query_vec = emb.reshape(1, -1)

        sims = cosine_similarity(query_vec, self.content_matrix)[0]
        # Sort descending, skip self
        ranked_indices = np.argsort(sims)[::-1]
        results = []
        for i in ranked_indices:
            sid = self.song_ids[i]
            if sid != song_id:
                results.append(sid)
            if len(results) >= limit:
                break
        return results

    # ─────────────────────────────────────────────
    # COLLABORATIVE FILTERING MODEL
    # ─────────────────────────────────────────────

    def build_collaborative_model(self):
        """
        Implicit collaborative filtering via SVD on a user-item interaction matrix.

        Interaction score per (user, song) pair:
          play=1, complete=2, repeat=3, like=5, skip=-1

        We decompose the sparse matrix into latent user and item factors,
        then compute predicted scores as user_factors @ item_factors.T
        """
        if not self.db:
            return

        # Load all listen events
        events = list(self.db.listenevents.find(
            {},
            {"user": 1, "song": 1, "event": 1}
        ))

        if len(events) < 10:
            print("⚠️  Not enough events for collaborative model (need ≥10)")
            return

        weight_map = {"play": 1, "complete": 2, "repeat": 3, "like": 5, "unlike": -3, "skip": -1}

        # Build interaction DataFrame
        rows = []
        for e in events:
            w = weight_map.get(e.get("event", "play"), 1)
            rows.append({"user": str(e["user"]), "song": str(e["song"]), "weight": w})

        df = pd.DataFrame(rows)
        df = df.groupby(["user", "song"])["weight"].sum().reset_index()
        df["weight"] = df["weight"].clip(lower=0)  # no negative totals

        # Index users and songs
        self.user_ids = df["user"].unique().tolist()
        self.collab_song_ids = df["song"].unique().tolist()

        user_idx = {u: i for i, u in enumerate(self.user_ids)}
        song_idx = {s: i for i, s in enumerate(self.collab_song_ids)}

        row = df["user"].map(user_idx).values
        col = df["song"].map(song_idx).values
        data = df["weight"].values.astype(np.float32)

        interaction_matrix = csr_matrix(
            (data, (row, col)),
            shape=(len(self.user_ids), len(self.collab_song_ids))
        )

        # SVD decomposition (k=50 latent factors)
        k = min(50, min(interaction_matrix.shape) - 1)
        self.svd_model = TruncatedSVD(n_components=k, random_state=42)
        self.user_factors = self.svd_model.fit_transform(interaction_matrix)
        self.item_factors = self.svd_model.components_.T  # (n_songs, k)

        self.collab_ready = True
        print(f"✅ Collaborative model built: {len(self.user_ids)} users, {len(self.collab_song_ids)} songs, k={k}")

    def get_collaborative_scores(self, user_id: str) -> Dict[str, float]:
        """
        Return predicted preference scores for all songs for a given user.
        Returns empty dict if user not in training data (cold start).
        """
        if not self.collab_ready or user_id not in self.user_ids:
            return {}

        u_idx = self.user_ids.index(user_id)
        user_vec = self.user_factors[u_idx]               # (k,)
        scores = user_vec @ self.item_factors.T            # (n_songs,)

        return {
            self.collab_song_ids[i]: float(scores[i])
            for i in range(len(self.collab_song_ids))
        }

    async def retrain_collaborative(self):
        """Async wrapper to retrain model in thread pool (non-blocking)."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.build_collaborative_model)
        await loop.run_in_executor(None, self.build_content_model)

    # ─────────────────────────────────────────────
    # HYBRID RECOMMENDATIONS
    # ─────────────────────────────────────────────

    def hybrid_recommend(
        self,
        user_id: str,
        ai_profile: Dict,
        listened_ids: List[str],
        current_mood: Optional[str],
        limit: int = 30,
    ) -> List[str]:
        """
        Hybrid recommendation algorithm:
          score = α * content_score + β * collab_score + γ * profile_score + mood_boost

        Where:
          content_score  = avg cosine similarity to user's top listened songs
          collab_score   = SVD predicted preference (normalised)
          profile_score  = dot product of song features with user's genre/mood weights
          mood_boost     = +0.3 if song mood matches current mood
        """
        if not self.song_ids:
            return []

        α, β, γ = 0.35, 0.40, 0.25

        # --- Collaborative scores ---
        collab_scores = self.get_collaborative_scores(user_id)

        # Normalise collab scores to [0,1]
        if collab_scores:
            max_c = max(collab_scores.values()) or 1.0
            collab_scores = {k: v / max_c for k, v in collab_scores.items()}

        # --- Content-based: avg similarity to top listened songs ---
        content_scores: Dict[str, float] = {}
        if listened_ids and self.content_matrix is not None:
            listened_in_index = [lid for lid in listened_ids if lid in self.song_ids][:10]
            if listened_in_index:
                listened_indices = [self.song_ids.index(lid) for lid in listened_in_index]
                user_content_vec = self.content_matrix[listened_indices].mean(axis=0, keepdims=True)
                sims = cosine_similarity(user_content_vec, self.content_matrix)[0]
                max_s = sims.max() or 1.0
                for i, sid in enumerate(self.song_ids):
                    content_scores[sid] = float(sims[i]) / max_s

        # --- Profile-based scoring ---
        genre_weights = ai_profile.get("genre_weights", {})
        mood_weights = ai_profile.get("mood_weights", {})
        total_genre = sum(abs(v) for v in genre_weights.values()) or 1.0
        total_mood = sum(abs(v) for v in mood_weights.values()) or 1.0

        # Fetch lightweight song metadata for scoring
        song_meta: Dict[str, Dict] = {}
        if self.db:
            try:
                docs = list(self.db.songs.find(
                    {"_id": {"$in": [ObjectId(sid) for sid in self.song_ids if len(sid) == 24]}},
                    {"_id": 1, "genre": 1, "mood": 1, "plays": 1}
                ))
                for d in docs:
                    song_meta[str(d["_id"])] = d
            except Exception:
                pass

        # Final scoring
        final_scores: Dict[str, float] = {}
        for sid in self.song_ids:
            if sid in listened_ids:
                continue  # skip already heard

            c_score = content_scores.get(sid, 0.0)
            col_score = collab_scores.get(sid, 0.0)

            # Profile score: how much user likes this song's genre/mood
            meta = song_meta.get(sid, {})
            g_score = genre_weights.get(meta.get("genre", ""), 0.0) / total_genre
            m_score = mood_weights.get(meta.get("mood", ""), 0.0) / total_mood
            p_score = max(0.0, (g_score + m_score) / 2.0)

            # Mood boost
            mood_boost = 0.3 if (current_mood and meta.get("mood") == current_mood) else 0.0

            score = α * c_score + β * col_score + γ * p_score + mood_boost
            final_scores[sid] = score

        # Sort and return top-N
        ranked = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
        return [sid for sid, _ in ranked[:limit]]

    def get_song_count(self) -> int:
        return len(self.song_ids)
