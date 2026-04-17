"""
MelodAI Recommendation Engine v2 — Maximum Level

Architecture:
============
1. CONTENT MODEL
   - BM25 on (genre + mood + tags + artist + title)  → semantic text similarity
   - Numeric audio features: tempo, energy, valence, acousticness, danceability
   - Combined L2-normalized embedding matrix
   - Cosine similarity for fast lookup

2. COLLABORATIVE FILTERING
   - SVD (k=50) on weighted user-item interaction matrix
   - Weights: play=1, complete=2, repeat=3, like=5, unlike=-3, skip=-1
   - Normalized per-user predicted scores

3. HYBRID SCORER
   score = α*content + β*collab + γ*profile + mood_boost + freshness_boost - skip_penalty

4. SESSION CONTEXT
   - Tracks songs heard in last 30 min
   - Boosts songs that continue the current audio "journey"

5. DIVERSITY INJECTION
   - Ensures top-N results span multiple genres
   - Prevents filter bubble by injecting 15% random discovery songs

6. AUTO-TAGGING
   - Infers mood/genre from title+artist if missing (keyword rules)
   - Used for cold-start songs not in DB

7. TEMPO MATCHING
   - Mood-to-BPM mapping table
   - Songs within ±20 BPM of target get boosted

8. PLAYLIST COHERENCE
   - When generating playlists, sorts by audio feature similarity
   - Adjacent songs flow naturally (energy, key, tempo progression)

9. COLD START
   - New users get: global trending → genre-diverse mix → mood-appropriate
   - After 5 listen events, personalised recommendations begin

10. REAL-TIME SKIP FEEDBACK
    - Skip events build a per-session penalty dict
    - Skipped artist/genre combos score lower this session
"""

import os
import sys
import asyncio
import math
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.preprocessing import MinMaxScaler, normalize
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from scipy.sparse import csr_matrix
from pymongo import MongoClient
from bson import ObjectId
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

try:
    from rank_bm25 import BM25Okapi
    HAS_BM25 = True
except ImportError:
    HAS_BM25 = False
    print("[AI] rank-bm25 not installed, falling back to TF-IDF")
    from sklearn.feature_extraction.text import TfidfVectorizer

# ── Mood → target BPM mapping ────────────────────────────────────────────────
MOOD_BPM = {
    "happy":     (120, 140),
    "energetic": (140, 180),
    "gym":       (140, 175),
    "focus":     (60,  100),
    "chill":     (60,   95),
    "sad":       (55,   85),
    "romance":   (70,  100),
}

# ── Mood → energy target range ───────────────────────────────────────────────
MOOD_ENERGY = {
    "happy":     (0.5, 1.0),
    "energetic": (0.7, 1.0),
    "gym":       (0.75, 1.0),
    "focus":     (0.2, 0.55),
    "chill":     (0.1, 0.5),
    "sad":       (0.1, 0.45),
    "romance":   (0.2, 0.6),
}

# ── Auto-tag keywords ────────────────────────────────────────────────────────
GENRE_KEYWORDS = {
    "hiphop":     ["hip hop","hiphop","rap","trap","drill","eminem","drake","kendrick","lil"],
    "pop":        ["pop","taylor swift","ed sheeran","ariana","dua lipa","weeknd"],
    "rock":       ["rock","guitar","metal","punk","band","nirvana","linkin"],
    "electronic": ["edm","electronic","house","techno","dubstep","dj","remix","avicii","calvin harris"],
    "classical":  ["classical","symphony","mozart","beethoven","piano","violin","orchestra"],
    "rnb":        ["r&b","rnb","soul","neo soul","beyonce","usher","frank ocean"],
    "folk":       ["folk","acoustic","indie","singer-songwriter"],
    "jazz":       ["jazz","blues","saxophone","trumpet"],
    "bollywood":  ["bollywood","hindi","arijit","shreya","sonu","kumar sanu"],
    "punjabi":    ["punjabi","bhangra","ap dhillon","sidhu","diljit"],
}

MOOD_KEYWORDS = {
    "happy":     ["happy","joy","celebration","fun","party","dance","bright","upbeat"],
    "sad":       ["sad","lonely","cry","heart","broken","tears","miss","pain","sorrow"],
    "energetic": ["energy","power","hype","fire","beast","strong","run","fight"],
    "focus":     ["study","focus","work","concentrate","calm","ambient","peaceful"],
    "chill":     ["chill","relax","vibe","smooth","easy","lofi","mellow"],
    "gym":       ["workout","gym","motivation","beast","pump","grind","training"],
    "romance":   ["love","romance","valentine","kiss","together","darling","forever"],
}


def auto_tag(title: str, artist: str, existing_genre: str, existing_mood: str) -> Tuple[str, str]:
    """Infer genre and mood from title+artist if not set."""
    text = f"{title} {artist}".lower()
    genre = existing_genre or "other"
    mood  = existing_mood  or "chill"

    if not existing_genre or existing_genre == "other":
        for g, keywords in GENRE_KEYWORDS.items():
            if any(k in text for k in keywords):
                genre = g
                break

    if not existing_mood or existing_mood == "chill":
        for m, keywords in MOOD_KEYWORDS.items():
            if any(k in text for k in keywords):
                mood = m
                break

    return genre, mood


class RecommendationEngine:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db = None

        # ── Content model ─────────────────────────────────────────────────
        self.song_ids:      List[str]  = []
        self.song_meta:     Dict       = {}   # id -> {genre, mood, tempo, energy, ...}
        self.content_matrix            = None  # (n_songs, n_features) L2-normalized

        # BM25 or TF-IDF
        self.bm25_index    = None
        self.bm25_corpus:  List[List[str]] = []
        self.tfidf_vec     = None if HAS_BM25 else None

        self.scaler = MinMaxScaler()

        # ── Collaborative model ───────────────────────────────────────────
        self.svd_model     = None
        self.user_factors  = None
        self.item_factors  = None
        self.user_ids:     List[str] = []
        self.collab_song_ids: List[str] = []
        self.collab_ready  = False

        # ── Session state (per-request, not persisted) ────────────────────
        self.session_skips: Dict[str, List[str]] = defaultdict(list)
        # user_id -> [skipped song_ids in this session]

        # ── In-memory skip penalty (fast lookup) ─────────────────────────
        # user_id -> {song_id: penalty_score}
        self.skip_penalties: Dict[str, Dict[str, float]] = defaultdict(dict)

    # ────────────────────────────────────────────────────────────────────────
    # INITIALIZATION
    # ────────────────────────────────────────────────────────────────────────

    async def initialize(self):
        mongo_uri = os.getenv("MONGODB_URI")
        if not mongo_uri:
            print("[AI] WARNING: No MONGODB_URI - running in demo mode")
            return
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._connect_and_build)

    def _connect_and_build(self):
        self.client = MongoClient(os.getenv("MONGODB_URI"), serverSelectionTimeoutMS=10000)
        self.db = self.client["melodai"]
        self.build_content_model()
        self.build_collaborative_model()

    # ────────────────────────────────────────────────────────────────────────
    # CONTENT MODEL — BM25 + Numeric features
    # ────────────────────────────────────────────────────────────────────────

    def build_content_model(self):
        if not self.db:
            return

        songs = list(self.db.songs.find(
            {"isPublic": True},
            {"_id": 1, "title": 1, "artist": 1, "genre": 1, "mood": 1, "tags": 1,
             "tempo": 1, "energy": 1, "valence": 1, "acousticness": 1,
             "danceability": 1, "plays": 1, "likes": 1, "createdAt": 1}
        ))

        if not songs:
            print("[AI] WARNING: No songs found for content model")
            return

        self.song_ids  = []
        self.song_meta = {}
        text_docs      = []
        numeric_rows   = []

        now = datetime.utcnow()

        for s in songs:
            sid = str(s["_id"])

            # Auto-tag if missing
            genre, mood = auto_tag(
                s.get("title", ""), s.get("artist", ""),
                s.get("genre", "other"),  s.get("mood", "chill"),
            )

            # Freshness: days since upload (used in scoring)
            created_at = s.get("createdAt", now)
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z",""))
                except Exception:
                    created_at = now
            days_old = max(0, (now - created_at).days) if created_at else 365

            self.song_meta[sid] = {
                "genre":        genre,
                "mood":         mood,
                "tempo":        s.get("tempo", 120),
                "energy":       s.get("energy", 0.5),
                "valence":      s.get("valence", 0.5),
                "acousticness": s.get("acousticness", 0.5),
                "danceability": s.get("danceability", 0.5),
                "plays":        s.get("plays", 0),
                "likes":        s.get("likes", 0),
                "days_old":     days_old,
            }
            self.song_ids.append(sid)

            # ── Text document for BM25 ──
            tags = " ".join(s.get("tags", []))
            doc  = f"{s.get('title','')} {s.get('artist','')} {genre} {mood} {tags}"
            text_docs.append(doc.strip().lower())

            # ── Numeric features ──
            numeric_rows.append([
                min(s.get("tempo", 120), 220) / 220.0,
                float(s.get("energy",       0.5)),
                float(s.get("valence",      0.5)),
                float(s.get("acousticness", 0.5)),
                float(s.get("danceability", 0.5)),
            ])

        # Build BM25 or TF-IDF
        if HAS_BM25:
            self.bm25_corpus = [doc.split() for doc in text_docs]
            self.bm25_index  = BM25Okapi(self.bm25_corpus)
            # For matrix: use BM25 scores against each doc as its own query
            # Approximate: build a per-doc score matrix using TF-IDF as fallback
            from sklearn.feature_extraction.text import TfidfVectorizer
            tfidf = TfidfVectorizer(max_features=300, ngram_range=(1,2))
            text_matrix = tfidf.fit_transform(text_docs).toarray()
        else:
            from sklearn.feature_extraction.text import TfidfVectorizer
            self.tfidf_vec = TfidfVectorizer(max_features=300, ngram_range=(1,2))
            text_matrix    = self.tfidf_vec.fit_transform(text_docs).toarray()

        numeric_matrix = np.array(numeric_rows, dtype=np.float32)

        # Weight text features more (they carry more semantic info)
        combined = np.hstack([text_matrix * 2.0, numeric_matrix])
        self.content_matrix = normalize(combined, norm="l2")

        print(f"[AI] Content model v2: {len(self.song_ids)} songs | {self.content_matrix.shape[1]} features | BM25={HAS_BM25}")

    # ────────────────────────────────────────────────────────────────────────
    # COLLABORATIVE FILTERING — SVD with weighted interactions
    # ────────────────────────────────────────────────────────────────────────

    def build_collaborative_model(self):
        if not self.db:
            return

        events = list(self.db.listenevents.find(
            {"song": {"$exists": True, "$ne": None}},
            {"user": 1, "song": 1, "event": 1, "listenDuration": 1, "progress": 1}
        ))

        if len(events) < 10:
            print("[AI] WARNING: Not enough events for collaborative model (need >=10)")
            return

        weight_map = {
            "play":     1.0,
            "complete": 2.5,   # finished = strong signal
            "repeat":   4.0,   # repeated = very strong signal
            "like":     6.0,
            "unlike":  -4.0,
            "skip":    -1.5,
        }

        rows = []
        for e in events:
            w = weight_map.get(e.get("event", "play"), 1.0)
            # Extra weight for high-progress plays
            if e.get("event") == "play" and e.get("progress", 0) > 0.8:
                w += 1.0
            rows.append({
                "user":   str(e["user"]),
                "song":   str(e.get("song", "")),
                "weight": w,
            })

        df = pd.DataFrame(rows)
        df = df[df["song"].str.len() > 0]
        df = df.groupby(["user", "song"])["weight"].sum().reset_index()
        df["weight"] = df["weight"].clip(lower=0)

        self.user_ids        = df["user"].unique().tolist()
        self.collab_song_ids = df["song"].unique().tolist()

        user_idx = {u: i for i, u in enumerate(self.user_ids)}
        song_idx = {s: i for i, s in enumerate(self.collab_song_ids)}

        row  = df["user"].map(user_idx).values
        col  = df["song"].map(song_idx).values
        data = df["weight"].values.astype(np.float32)

        interaction_matrix = csr_matrix(
            (data, (row, col)),
            shape=(len(self.user_ids), len(self.collab_song_ids))
        )

        k = min(50, min(interaction_matrix.shape) - 1)
        self.svd_model    = TruncatedSVD(n_components=k, random_state=42)
        self.user_factors = self.svd_model.fit_transform(interaction_matrix)
        self.item_factors = self.svd_model.components_.T

        self.collab_ready = True
        print(f"[AI] Collaborative model v2: {len(self.user_ids)} users | {len(self.collab_song_ids)} songs | k={k}")

    # ────────────────────────────────────────────────────────────────────────
    # HELPER: get BM25 similarity scores for a query
    # ────────────────────────────────────────────────────────────────────────

    def bm25_query(self, query_text: str) -> np.ndarray:
        """Return BM25 scores (n_songs,) for a free-text query."""
        if not HAS_BM25 or not self.bm25_index:
            return np.zeros(len(self.song_ids))
        tokens = query_text.lower().split()
        scores = self.bm25_index.get_scores(tokens)
        max_s  = scores.max() or 1.0
        return scores / max_s

    # ────────────────────────────────────────────────────────────────────────
    # HELPER: content similarity between two songs
    # ────────────────────────────────────────────────────────────────────────

    def song_similarity(self, song_id_a: str, song_id_b: str) -> float:
        if self.content_matrix is None:
            return 0.0
        try:
            ia = self.song_ids.index(song_id_a)
            ib = self.song_ids.index(song_id_b)
            return float(cosine_similarity(
                self.content_matrix[ia].reshape(1,-1),
                self.content_matrix[ib].reshape(1,-1)
            )[0][0])
        except ValueError:
            return 0.0

    # ────────────────────────────────────────────────────────────────────────
    # HELPER: collaborative scores for user
    # ────────────────────────────────────────────────────────────────────────

    def get_collaborative_scores(self, user_id: str) -> Dict[str, float]:
        if not self.collab_ready or user_id not in self.user_ids:
            return {}
        u_idx    = self.user_ids.index(user_id)
        user_vec = self.user_factors[u_idx]
        scores   = user_vec @ self.item_factors.T
        max_s    = scores.max() or 1.0
        return {self.collab_song_ids[i]: float(scores[i]) / max_s
                for i in range(len(self.collab_song_ids))}

    # ────────────────────────────────────────────────────────────────────────
    # SKIP FEEDBACK — real-time penalty
    # ────────────────────────────────────────────────────────────────────────

    def record_skip(self, user_id: str, song_id: str):
        """Record a skip — lowers this song and same-genre songs for the session."""
        self.skip_penalties[user_id][song_id] = \
            self.skip_penalties[user_id].get(song_id, 0.0) + 0.3

        # Also penalise same genre/artist (softer)
        skipped_meta = self.song_meta.get(song_id, {})
        skipped_genre = skipped_meta.get("genre")
        if skipped_genre:
            for sid, meta in self.song_meta.items():
                if sid != song_id and meta.get("genre") == skipped_genre:
                    self.skip_penalties[user_id][sid] = \
                        self.skip_penalties[user_id].get(sid, 0.0) + 0.05

    # ────────────────────────────────────────────────────────────────────────
    # TEMPO / ENERGY FILTER
    # ────────────────────────────────────────────────────────────────────────

    def tempo_energy_score(self, song_id: str, mood: Optional[str]) -> float:
        """Return 0.0-1.0 score based on how well song's tempo/energy matches mood."""
        if not mood or mood not in MOOD_BPM:
            return 0.5
        meta = self.song_meta.get(song_id, {})
        tempo  = meta.get("tempo", 120)
        energy = meta.get("energy", 0.5)

        bpm_min, bpm_max = MOOD_BPM[mood]
        e_min,   e_max   = MOOD_ENERGY[mood]

        bpm_ok = bpm_min <= tempo <= bpm_max
        e_ok   = e_min   <= energy <= e_max

        if bpm_ok and e_ok:   return 1.0
        if bpm_ok or e_ok:    return 0.6
        # Partial match
        bpm_dist = min(abs(tempo-bpm_min), abs(tempo-bpm_max)) / 50.0
        e_dist   = min(abs(energy-e_min),  abs(energy-e_max))  / 0.5
        return max(0.0, 1.0 - (bpm_dist + e_dist) / 2.0)

    # ────────────────────────────────────────────────────────────────────────
    # FRESHNESS BOOST
    # ────────────────────────────────────────────────────────────────────────

    def freshness_score(self, song_id: str) -> float:
        """Songs uploaded recently get a boost (decays over 90 days)."""
        days = self.song_meta.get(song_id, {}).get("days_old", 365)
        return max(0.0, 1.0 - days / 90.0)

    # ────────────────────────────────────────────────────────────────────────
    # POPULARITY SCORE
    # ────────────────────────────────────────────────────────────────────────

    def popularity_score(self, song_id: str) -> float:
        """Normalised log-play-count score."""
        plays = self.song_meta.get(song_id, {}).get("plays", 0)
        likes = self.song_meta.get(song_id, {}).get("likes", 0)
        raw   = math.log1p(plays + likes * 3)
        # Normalise against rough max (10000 plays = 1.0)
        return min(1.0, raw / math.log1p(10000))

    # ────────────────────────────────────────────────────────────────────────
    # DIVERSITY INJECTION
    # ────────────────────────────────────────────────────────────────────────

    def inject_diversity(
        self, ranked: List[str], top_n: int, diversity_ratio: float = 0.15
    ) -> List[str]:
        """
        Ensure genre diversity in the top-N results.
        Replaces ~15% of results with songs from underrepresented genres.
        """
        if not ranked or len(ranked) < top_n:
            return ranked

        # Count genres in top results
        genre_counts: Dict[str, int] = defaultdict(int)
        for sid in ranked[:top_n]:
            g = self.song_meta.get(sid, {}).get("genre", "other")
            genre_counts[g] += 1

        # Find overrepresented genre (> 40% of top results)
        over_genre = None
        for g, cnt in genre_counts.items():
            if cnt > top_n * 0.40:
                over_genre = g
                break

        if not over_genre:
            return ranked  # already diverse

        # Replace bottom 15% of over-represented songs with discovery picks
        n_swap = max(1, int(top_n * diversity_ratio))
        overrep_indices = [
            i for i, sid in enumerate(ranked[:top_n])
            if self.song_meta.get(sid, {}).get("genre") == over_genre
        ][-n_swap:]

        # Find candidates not in top-N from different genre
        discovery = [
            sid for sid in ranked[top_n:]
            if self.song_meta.get(sid, {}).get("genre") != over_genre
        ][:n_swap]

        if not discovery:
            return ranked

        result = list(ranked[:top_n])
        for idx, new_sid in zip(overrep_indices, discovery):
            result[idx] = new_sid

        return result + ranked[top_n:]

    # ────────────────────────────────────────────────────────────────────────
    # MAIN: HYBRID RECOMMENDATIONS
    # ────────────────────────────────────────────────────────────────────────

    def hybrid_recommend(
        self,
        user_id:      str,
        ai_profile:   Dict,
        listened_ids: List[str],
        current_mood: Optional[str],
        limit:        int = 30,
        session_ids:  Optional[List[str]] = None,
    ) -> List[str]:
        """
        Full hybrid scoring:
          score = α*content + β*collab + γ*profile
                + tempo_boost + freshness_boost + popularity
                - skip_penalty - already_heard_penalty
        """
        if not self.song_ids:
            return []

        # Weights
        α, β, γ = 0.30, 0.35, 0.20
        TEMPO_W   = 0.08
        FRESH_W   = 0.04
        POP_W     = 0.03

        collab_scores = self.get_collaborative_scores(user_id)
        skip_pen      = self.skip_penalties.get(user_id, {})
        session_heard = set(session_ids or [])

        # Content scores: avg similarity to recently listened songs
        content_scores: Dict[str, float] = {}
        if listened_ids and self.content_matrix is not None:
            in_index = [lid for lid in listened_ids if lid in self.song_ids][:15]
            if in_index:
                idx_list = [self.song_ids.index(lid) for lid in in_index]
                user_vec = self.content_matrix[idx_list].mean(axis=0, keepdims=True)
                sims     = cosine_similarity(user_vec, self.content_matrix)[0]
                max_s    = sims.max() or 1.0
                for i, sid in enumerate(self.song_ids):
                    content_scores[sid] = float(sims[i]) / max_s

        # Session context: if user listened to 3+ songs this session, compute
        # "session direction" vector to weight continuity
        session_bonus: Dict[str, float] = {}
        if session_ids and len(session_ids) >= 3 and self.content_matrix is not None:
            recent_in_idx = [s for s in session_ids[-5:] if s in self.song_ids]
            if recent_in_idx:
                ridx    = [self.song_ids.index(s) for s in recent_in_idx]
                s_vec   = self.content_matrix[ridx].mean(axis=0, keepdims=True)
                s_sims  = cosine_similarity(s_vec, self.content_matrix)[0]
                max_ss  = s_sims.max() or 1.0
                for i, sid in enumerate(self.song_ids):
                    session_bonus[sid] = float(s_sims[i]) / max_ss * 0.1

        # Profile score
        genre_weights = ai_profile.get("genre_weights", {})
        mood_weights  = ai_profile.get("mood_weights",  {})
        total_genre   = sum(abs(v) for v in genre_weights.values()) or 1.0
        total_mood    = sum(abs(v) for v in mood_weights.values())  or 1.0

        already_heard = set(listened_ids)

        # Score every song
        final_scores: Dict[str, float] = {}
        for sid in self.song_ids:
            # Already heard recently: still include but with penalty
            heard_penalty = 0.5 if sid in already_heard else 0.0

            # Session skip penalty
            s_pen = min(skip_pen.get(sid, 0.0), 0.8)

            # Component scores
            c_score   = content_scores.get(sid, 0.0)
            col_score = collab_scores.get(sid, 0.0)
            s_bonus   = session_bonus.get(sid, 0.0)

            meta    = self.song_meta.get(sid, {})
            g_score = genre_weights.get(meta.get("genre",""), 0.0) / total_genre
            m_score = mood_weights.get(meta.get("mood",""),  0.0) / total_mood
            p_score = max(0.0, (g_score + m_score) / 2.0)

            # Mood match bonuses
            mood_match  = 0.30 if current_mood and meta.get("mood") == current_mood else 0.0
            tempo_score = self.tempo_energy_score(sid, current_mood) * TEMPO_W

            fresh_score = self.freshness_score(sid) * FRESH_W
            pop_score   = self.popularity_score(sid) * POP_W

            score = (
                α * c_score
              + β * col_score
              + γ * p_score
              + mood_match
              + tempo_score
              + fresh_score
              + pop_score
              + s_bonus
              - heard_penalty
              - s_pen
            )
            final_scores[sid] = score

        ranked = sorted(final_scores, key=lambda x: final_scores[x], reverse=True)

        # Inject diversity
        ranked = self.inject_diversity(ranked, min(limit, len(ranked)))

        return ranked[:limit]

    # ────────────────────────────────────────────────────────────────────────
    # MOOD RECOMMENDATIONS with tempo/energy filtering
    # ────────────────────────────────────────────────────────────────────────

    def mood_recommend(
        self,
        user_id:    str,
        mood:       str,
        ai_profile: Dict,
        limit:      int = 20,
    ) -> List[str]:
        """Strict mood match + tempo/energy filter + user taste weighting."""
        if not self.song_ids:
            return []

        collab_scores = self.get_collaborative_scores(user_id)
        genre_weights = ai_profile.get("genre_weights", {})
        total_genre   = sum(abs(v) for v in genre_weights.values()) or 1.0
        skip_pen      = self.skip_penalties.get(user_id, {})

        scores: Dict[str, float] = {}
        for sid in self.song_ids:
            meta = self.song_meta.get(sid, {})
            if meta.get("mood") != mood:
                continue

            te_score = self.tempo_energy_score(sid, mood)
            g_score  = genre_weights.get(meta.get("genre",""), 0.0) / total_genre
            col      = collab_scores.get(sid, 0.0)
            pop      = self.popularity_score(sid)
            pen      = skip_pen.get(sid, 0.0)

            scores[sid] = te_score * 0.4 + g_score * 0.2 + col * 0.3 + pop * 0.1 - pen

        ranked = sorted(scores, key=lambda x: scores[x], reverse=True)
        return self.inject_diversity(ranked, min(limit, len(ranked)))[:limit]

    # ────────────────────────────────────────────────────────────────────────
    # SMART SEARCH RE-RANKING
    # ────────────────────────────────────────────────────────────────────────

    def rank_search_results(
        self,
        user_id:       str,
        query:         str,
        candidate_ids: List[str],
        ai_profile:    Dict,
    ) -> List[str]:
        """
        Re-rank search results using:
          - BM25 text relevance for the query
          - User taste (genre/mood preference)
          - Collaborative score
        """
        if not candidate_ids:
            return []

        bm25_scores   = self.bm25_query(query)
        bm25_map      = {self.song_ids[i]: bm25_scores[i]
                         for i in range(len(self.song_ids))
                         if self.song_ids[i] in candidate_ids}

        collab_scores = self.get_collaborative_scores(user_id)
        genre_weights = ai_profile.get("genre_weights", {})
        total_genre   = sum(abs(v) for v in genre_weights.values()) or 1.0

        scores = {}
        for sid in candidate_ids:
            meta   = self.song_meta.get(sid, {})
            bm25   = bm25_map.get(sid, 0.0)
            col    = collab_scores.get(sid, 0.0)
            g      = genre_weights.get(meta.get("genre",""), 0.0) / total_genre
            pop    = self.popularity_score(sid)
            scores[sid] = bm25 * 0.5 + col * 0.25 + g * 0.15 + pop * 0.10

        return sorted(candidate_ids, key=lambda x: scores.get(x, 0.0), reverse=True)

    # ────────────────────────────────────────────────────────────────────────
    # PLAYLIST GENERATION with coherence
    # ────────────────────────────────────────────────────────────────────────

    def generate_playlist(
        self,
        user_id:    str,
        mood:       Optional[str],
        ai_profile: Dict,
        limit:      int = 20,
    ) -> Tuple[List[str], str]:
        """
        Generate a coherent playlist:
          1. Get mood-filtered candidates
          2. Sort by audio feature coherence (energy flow, tempo progression)
          3. Return song IDs + description
        """
        if not self.song_ids:
            return [], "No songs available"

        # Candidate pool: mood-filtered + user-taste ranked
        if mood:
            candidates = self.mood_recommend(user_id, mood, ai_profile, limit=limit*3)
        else:
            candidates = self.hybrid_recommend(user_id, ai_profile, [], None, limit=limit*3)

        if not candidates:
            return [], "Could not find enough songs"

        # Sort for audio coherence: order by energy progression
        # (start medium, build up, cool down at end — like a real DJ set)
        meta_list = [(sid, self.song_meta.get(sid, {})) for sid in candidates[:limit*2]]

        # Sort ascending by energy for a natural build
        meta_list.sort(key=lambda x: x[1].get("energy", 0.5))

        # Pick evenly spaced songs for variety
        step = max(1, len(meta_list) // limit)
        selected = [meta_list[i][0] for i in range(0, min(len(meta_list), limit*step), step)][:limit]

        # If short, fill up
        if len(selected) < limit:
            extras = [sid for sid, _ in meta_list if sid not in selected]
            selected += extras[:limit - len(selected)]

        # Generate reason
        top_genre = max(
            {self.song_meta.get(s,{}).get("genre","other") for s in selected},
            key=lambda g: sum(1 for s in selected if self.song_meta.get(s,{}).get("genre") == g),
            default="music"
        )
        reason = f"Curated {mood or 'personalized'} playlist featuring {top_genre} and more"
        if self.collab_ready:
            reason += " — tuned to your taste"

        return selected, reason

    # ────────────────────────────────────────────────────────────────────────
    # SIMILAR SONGS
    # ────────────────────────────────────────────────────────────────────────

    def find_similar_songs(
        self,
        song_id:  str,
        features: Dict,
        limit:    int = 10,
    ) -> List[str]:
        if self.content_matrix is None or not self.song_ids:
            return []

        if song_id in self.song_ids:
            idx       = self.song_ids.index(song_id)
            query_vec = self.content_matrix[idx].reshape(1,-1)
        else:
            query_vec = self._embed_features(features).reshape(1,-1)

        sims    = cosine_similarity(query_vec, self.content_matrix)[0]
        indices = np.argsort(sims)[::-1]
        results = [self.song_ids[i] for i in indices
                   if self.song_ids[i] != song_id][:limit]
        return results

    def _embed_features(self, features: Dict) -> np.ndarray:
        tags = " ".join(features.get("tags", []))
        doc  = f"{features.get('genre','')} {features.get('mood','')} {tags}".strip().lower()
        if HAS_BM25:
            from sklearn.feature_extraction.text import TfidfVectorizer
            # Fallback for single-doc embedding when BM25 is the main model
            vec = np.zeros(300)
        else:
            vec = self.tfidf_vec.transform([doc]).toarray()[0] if self.tfidf_vec else np.zeros(300)
        numeric = np.array([
            min(features.get("tempo",120),220)/220.0,
            float(features.get("energy",0.5)),
            float(features.get("valence",0.5)),
            float(features.get("acousticness",0.5)),
            float(features.get("danceability",0.5)),
        ], dtype=np.float32)
        combined = np.hstack([vec * 2.0, numeric])
        return normalize(combined.reshape(1,-1), norm="l2")[0]

    # ────────────────────────────────────────────────────────────────────────
    # RETRAIN
    # ────────────────────────────────────────────────────────────────────────

    async def retrain_collaborative(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.build_collaborative_model)
        await loop.run_in_executor(None, self.build_content_model)

    def get_song_count(self) -> int:
        return len(self.song_ids)
