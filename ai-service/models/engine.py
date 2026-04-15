"""
RecommendationEngine — hybrid content-based + collaborative filtering.

Attributes used by routes:
  engine.db               — pymongo Database or None
  engine.song_ids         — list[str] of all indexed song IDs
  engine.content_matrix   — np.ndarray (N, FEATURE_DIM) or None
  engine.collab_ready     — bool
  engine.hybrid_recommend(...)
  engine.get_content_embedding(features) -> np.ndarray
  engine.find_similar_songs(song_id, features, limit) -> list[str]
  engine.get_collaborative_scores(user_id) -> dict[str, float]
"""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from pymongo import MongoClient

# Feature dimensions
GENRES = ["pop", "rock", "hip-hop", "electronic", "jazz", "classical", "r&b",
          "country", "folk", "reggae", "blues", "metal", "latin", "indie", "other"]
MOODS  = ["happy", "sad", "energetic", "focus", "chill", "gym", "romance"]

# Weights per listen event (for collaborative matrix)
EVENT_WEIGHTS = {
    "play":     1.0,
    "complete": 2.0,
    "like":     3.0,
    "repeat":   2.5,
    "skip":    -0.5,
    "unlike":  -2.0,
}

FEATURE_DIM = len(GENRES) + len(MOODS) + 5   # 15 + 7 + 5 = 27
EMBED_DIM   = 205                              # padded embedding size for external API


class RecommendationEngine:
    def __init__(self, mongodb_uri: str | None = None):
        self.db             = None
        self.song_ids:  list = []
        self.content_matrix = None   # np.ndarray (N, FEATURE_DIM) or None

        # Collaborative filtering data
        self.collab_matrix   = None  # np.ndarray (U, S)
        self.collab_user_ids: list = []
        self.collab_song_ids: list = []
        self.collab_ready    = False

        if mongodb_uri:
            try:
                client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
                client.admin.command("ping")           # fast connectivity check
                self.db = client.melodai
                print("✅ MongoDB connected")
                self._build_content_matrix()
                self._build_collab_matrix()
            except Exception as e:
                print(f"⚠️  MongoDB connection failed: {e}  — running without DB")

    # ── Content matrix ────────────────────────────────────────────────────────

    def _build_content_matrix(self):
        """Build normalised content feature matrix from all public songs."""
        if not self.db:
            return
        try:
            songs = list(self.db.songs.find(
                {"isPublic": True},
                {"_id": 1, "genre": 1, "mood": 1, "tempo": 1,
                 "energy": 1, "valence": 1, "acousticness": 1, "danceability": 1}
            ))
            if not songs:
                print("ℹ️  No songs in DB — content matrix skipped")
                return

            self.song_ids = [str(s["_id"]) for s in songs]
            features = [self._song_to_vector(s) for s in songs]

            mat = np.array(features, dtype=float)
            # L2-normalise rows (skip zero rows)
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.content_matrix = mat / norms
            print(f"✅ Content matrix built: {mat.shape}")
        except Exception as e:
            print(f"⚠️  Content matrix error: {e}")

    def _song_to_vector(self, song: dict) -> list:
        genre = (song.get("genre") or "").lower()
        mood  = (song.get("mood")  or "").lower()
        g_vec = [1.0 if g == genre else 0.0 for g in GENRES]
        m_vec = [1.0 if m == mood  else 0.0 for m in MOODS]
        a_vec = [
            min(float(song.get("tempo",        120)) / 200.0, 1.0),
            float(song.get("energy",       0.5)),
            float(song.get("valence",      0.5)),
            float(song.get("acousticness", 0.5)),
            float(song.get("danceability", 0.5)),
        ]
        return g_vec + m_vec + a_vec

    # ── Collaborative matrix ──────────────────────────────────────────────────

    def _build_collab_matrix(self):
        """Build user-song interaction matrix from listen events."""
        if not self.db:
            return
        try:
            events = list(self.db.listenevents.find(
                {"song": {"$exists": True, "$ne": None}},
                {"user": 1, "song": 1, "event": 1}
            ))
            if not events:
                print("ℹ️  No listen events — collaborative filtering skipped")
                return

            user_song: dict = {}
            for e in events:
                uid = str(e["user"])
                sid = str(e["song"])
                w   = EVENT_WEIGHTS.get(e.get("event", "play"), 1.0)
                user_song[(uid, sid)] = user_song.get((uid, sid), 0.0) + w

            user_ids = list({k[0] for k in user_song})
            song_ids = list({k[1] for k in user_song})
            u_idx    = {u: i for i, u in enumerate(user_ids)}
            s_idx    = {s: i for i, s in enumerate(song_ids)}

            mat = np.zeros((len(user_ids), len(song_ids)), dtype=float)
            for (uid, sid), score in user_song.items():
                mat[u_idx[uid], s_idx[sid]] = max(0.0, score)

            self.collab_matrix   = mat
            self.collab_user_ids = user_ids
            self.collab_song_ids = song_ids
            self.collab_ready    = True
            print(f"✅ Collaborative matrix built: {mat.shape}")
        except Exception as e:
            print(f"⚠️  Collaborative matrix error: {e}")

    # ── Public API ────────────────────────────────────────────────────────────

    def get_content_embedding(self, features: dict) -> np.ndarray:
        """Return a fixed-size (EMBED_DIM,) feature vector for a song."""
        vec = np.array(self._song_to_vector(features), dtype=float)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        padded = np.zeros(EMBED_DIM, dtype=float)
        padded[:len(vec)] = vec
        return padded

    def find_similar_songs(self, song_id: str, features: dict, limit: int = 10) -> list:
        """Content-based similarity search — returns up to `limit` song IDs."""
        if self.content_matrix is None or not self.song_ids:
            return []
        try:
            query = np.array(self._song_to_vector(features), dtype=float).reshape(1, -1)
            norm  = np.linalg.norm(query)
            if norm > 0:
                query = query / norm

            scores = cosine_similarity(query, self.content_matrix)[0]
            ranked = sorted(
                ((self.song_ids[i], float(scores[i]))
                 for i in range(len(self.song_ids))
                 if self.song_ids[i] != song_id),
                key=lambda x: x[1], reverse=True,
            )
            return [sid for sid, _ in ranked[:limit]]
        except Exception as e:
            print(f"⚠️  find_similar_songs error: {e}")
            return []

    def get_collaborative_scores(self, user_id: str) -> dict:
        """Return {song_id: score} collaborative preference scores for a user."""
        if not self.collab_ready or self.collab_matrix is None:
            return {}
        if user_id not in self.collab_user_ids:
            return {}
        try:
            u_idx = self.collab_user_ids.index(user_id)
            mat   = self.collab_matrix

            # Normalise rows for similarity computation
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            normed = mat / norms

            sims         = normed @ normed[u_idx]     # shape: (U,)
            sims[u_idx]  = 0.0                        # exclude self
            sim_sum      = float(np.sum(np.abs(sims)))

            weighted = sims @ mat                     # shape: (S,)
            if sim_sum > 0:
                weighted = weighted / sim_sum

            return {self.collab_song_ids[i]: float(weighted[i])
                    for i in range(len(self.collab_song_ids))}
        except Exception as e:
            print(f"⚠️  get_collaborative_scores error: {e}")
            return {}

    def hybrid_recommend(
        self,
        user_id:      str,
        ai_profile:   dict,
        listened_ids: list,
        current_mood: str | None = None,
        limit:        int        = 30,
    ) -> list:
        """
        Hybrid recommendation:
          60% content-preference (genre/mood weights from user AI profile)
          40% collaborative filtering
        Returns a list of song ID strings, sorted best-first.
        """
        if not self.song_ids:
            return []

        listened_set  = set(listened_ids)
        collab_scores = self.get_collaborative_scores(user_id) if self.collab_ready else {}

        genre_weights = ai_profile.get("genre_weights", {}) or {}
        mood_weights  = ai_profile.get("mood_weights",  {}) or {}
        total_weight  = (sum(genre_weights.values()) + sum(mood_weights.values())) or 1.0

        scored = []
        for sid in self.song_ids:
            if sid in listened_set:
                continue

            content_score = 0.0
            if self.db:
                try:
                    from bson import ObjectId
                    if len(sid) == 24:
                        doc = self.db.songs.find_one(
                            {"_id": ObjectId(sid)}, {"genre": 1, "mood": 1})
                        if doc:
                            genre = doc.get("genre", "")
                            mood  = doc.get("mood",  "")
                            mood_boost = 1.5 if current_mood and mood == current_mood else 1.0
                            content_score = (
                                genre_weights.get(genre, 0.0) +
                                mood_weights.get(mood,   0.0)
                            ) / total_weight * mood_boost
                except Exception:
                    pass

            collab = collab_scores.get(sid, 0.0)
            final  = 0.6 * content_score + 0.4 * collab
            scored.append((sid, final))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [sid for sid, _ in scored[:limit]]
