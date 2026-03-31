"""
Embedding and chunking helpers for full-control RAG ingestion.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
DEFAULT_EMBEDDING_DIM = 384
_model_instance: Any = None


def get_embedding_model() -> str:
    return os.getenv("LOCAL_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL).strip() or DEFAULT_EMBEDDING_MODEL


def get_expected_dimension() -> int | None:
    configured = os.getenv("LOCAL_EMBEDDING_DIM", "").strip()
    if configured.isdigit():
        return int(configured)
    return DEFAULT_EMBEDDING_DIM


def is_configured() -> bool:
    try:
        from fastembed import TextEmbedding  # noqa: F401
        return True
    except Exception:
        return False


def _get_model():
    global _model_instance
    if _model_instance is None:
        from fastembed import TextEmbedding
        _model_instance = TextEmbedding(model_name=get_embedding_model())
    return _model_instance


def chunk_text(text: str, *, chunk_size: int = 3000, chunk_overlap: int = 500) -> list[str]:
    """
    Chunk text by characters with overlap. Keeps dependencies light while giving predictable windows.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return []
    if chunk_size <= 0:
        chunk_size = 3000
    if chunk_overlap < 0:
        chunk_overlap = 0
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(0, chunk_size // 5)

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        segment = cleaned[start:end].strip()
        if segment:
            chunks.append(segment)
        if end >= len(cleaned):
            break
        start = end - chunk_overlap
    return chunks


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if not is_configured():
        raise RuntimeError("Local embedding dependencies are missing. Install fastembed.")

    model = _get_model()
    batch_size = 32
    output: list[list[float]] = []

    def _encode_batch(batch: list[str]) -> list[list[float]]:
        encoded = list(model.embed(batch))
        return [vec.tolist() for vec in encoded]

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        output.extend(await asyncio.to_thread(_encode_batch, batch))

    return output


async def embed_text(text: str) -> list[float]:
    vectors = await embed_texts([text])
    return vectors[0] if vectors else []


def embedding_status() -> dict[str, Any]:
    model = get_embedding_model()
    return {
        "configured": is_configured(),
        "model": model,
        "expected_dimension": get_expected_dimension(),
    }
