"""Retrieval service: search the parquet dataset for similar OpenSCAD models.

Loads the training dataset once and uses TF-IDF similarity to find
the most relevant existing models for a user prompt. When similarity
is high enough, the code is returned directly — no LLM needed.
"""

import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# Score threshold: above this, return the match directly without LLM
DIRECT_MATCH_THRESHOLD = 0.35


@dataclass
class RetrievedModel:
    name: str
    scad: str
    fakeprompt: str
    score: float
    thingiverse_id: int


_DEFAULT_PARQUET = Path(__file__).resolve().parents[2] / "train-00000-of-00001.parquet"


def _clean_scad(raw: str) -> str:
    """Strip filename headers and markdown fences from parquet scad data.

    The parquet stores scad as:
        filename.scad:
        ```
        <actual code>
        ```
    For multi-file entries, take just the first (main) file.
    """
    # Split on file boundaries (e.g. "something.scad:\n```")
    files = re.split(r'^[^\n]+\.scad:\s*\n```\n?', raw, flags=re.MULTILINE)

    # files[0] is empty (before first match), files[1] is first file content, etc.
    code = ""
    for chunk in files:
        chunk = chunk.strip()
        if not chunk:
            continue
        # Remove trailing ``` fence
        chunk = re.sub(r'\n```\s*$', '', chunk)
        if chunk:
            code = chunk
            break  # Take the first (main) file only

    # Fallback: if regex didn't match, strip fences from raw
    if not code:
        code = raw
        code = re.sub(r'^[^\n]+\.scad:\s*\n', '', code)
        code = re.sub(r'^```\s*\n?', '', code)
        code = re.sub(r'\n```\s*$', '', code)

    return code.strip()


class ScadRetriever:
    """TF-IDF based retriever over the parquet dataset."""

    _instance: "ScadRetriever | None" = None

    def __init__(self, parquet_path: str | Path | None = None):
        path = Path(parquet_path) if parquet_path else _DEFAULT_PARQUET
        if not path.exists():
            raise FileNotFoundError(f"Parquet file not found: {path}")

        df = pd.read_parquet(path, columns=["thingiverse_id", "name", "scad", "fakeprompt"])
        df = df.dropna(subset=["scad", "fakeprompt"]).reset_index(drop=True)

        self._df = df
        # Build search corpus from name + fakeprompt
        self._corpus = (df["name"].fillna("") + " " + df["fakeprompt"].fillna("")).tolist()

        self._vectorizer = TfidfVectorizer(
            max_features=10000,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        self._tfidf_matrix = self._vectorizer.fit_transform(self._corpus)

    @classmethod
    def get_instance(cls, parquet_path: str | Path | None = None) -> "ScadRetriever":
        """Singleton access — loads the dataset once."""
        if cls._instance is None:
            cls._instance = cls(parquet_path)
        return cls._instance

    def search(self, query: str, top_k: int = 3, min_score: float = 0.05) -> list[RetrievedModel]:
        """Find the top-k most similar models to the query."""
        query_vec = self._vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self._tfidf_matrix).flatten()

        top_indices = scores.argsort()[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score < min_score:
                continue
            row = self._df.iloc[idx]
            scad = _clean_scad(row["scad"])
            results.append(RetrievedModel(
                name=row["name"],
                scad=scad,
                fakeprompt=row["fakeprompt"][:500],
                score=score,
                thingiverse_id=int(row["thingiverse_id"]),
            ))
        return results

    def format_references(self, results: list[RetrievedModel]) -> str:
        """Format retrieved models as reference context for the LLM."""
        if not results:
            return ""

        parts = ["## Reference Models (from dataset — use as inspiration, adapt as needed)\n"]
        for i, r in enumerate(results, 1):
            parts.append(f"### Reference {i}: {r.name} (similarity: {r.score:.2f})")
            scad = r.scad if len(r.scad) <= 4000 else r.scad[:4000] + "\n// ... (truncated)"
            parts.append(f"```openscad\n{scad}\n```\n")
        return "\n".join(parts)
