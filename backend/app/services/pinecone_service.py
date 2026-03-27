"""
Optional Pinecone vector store service.

Only active when PINECONE_API_KEY and PINECONE_HOST are set in the environment.
Use for RAG, semantic search, or any vector operations alongside CreateAI.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

# Lazy import so app starts even if pinecone is not installed or not configured
_pinecone_module: Any = None
MAX_UPSERT_PAYLOAD_BYTES = 3_500_000
MAX_UPSERT_BATCH_VECTORS = 64


def _get_pinecone():
    global _pinecone_module
    if _pinecone_module is None:
        try:
            from pinecone import Pinecone
            _pinecone_module = Pinecone
        except ImportError:
            _pinecone_module = False
    return _pinecone_module


def is_configured() -> bool:
    """Return True if Pinecone is configured and usable."""
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    host = os.getenv("PINECONE_HOST", "").strip()
    return bool(api_key and host and _get_pinecone())


def get_index_host() -> str | None:
    """Return the index host URL if configured, else None."""
    host = os.getenv("PINECONE_HOST", "").strip()
    return host or None


async def query_vectors(
    vector: list[float],
    *,
    top_k: int = 10,
    namespace: str | None = None,
    filter_: dict | None = None,
    include_values: bool = False,
    include_metadata: bool = True,
) -> list[dict[str, Any]]:
    """
    Query the Pinecone index by vector. Returns list of matches with id, score, and optional metadata.

    Only runs when Pinecone is configured; otherwise returns [].
    """
    if not is_configured():
        return []

    Pinecone = _get_pinecone()
    if not Pinecone:
        return []

    api_key = os.getenv("PINECONE_API_KEY")
    host = get_index_host()
    if not host:
        return []

    pc = Pinecone(api_key=api_key)
    async with pc.IndexAsyncio(host=host) as idx:
        result = await idx.query(
            vector=vector,
            top_k=top_k,
            namespace=namespace or "",
            filter=filter_,
            include_values=include_values,
            include_metadata=include_metadata,
        )

    matches = getattr(result, "matches", []) or []
    return [
        {
            "id": getattr(m, "id", None),
            "score": getattr(m, "score", None),
            "metadata": getattr(m, "metadata", None) or {},
            "values": getattr(m, "values", None),
        }
        for m in matches
    ]


async def upsert_vectors(
    vectors: list[tuple[str, list[float], dict | None]],
    *,
    namespace: str | None = None,
) -> int | None:
    """
    Upsert vectors into the index. Each item is (id, vector, metadata).

    Returns number of vectors upserted, or None if Pinecone is not configured.
    """
    if not is_configured():
        return None

    Pinecone = _get_pinecone()
    if not Pinecone:
        return None

    api_key = os.getenv("PINECONE_API_KEY")
    host = get_index_host()
    if not host:
        return None

    records = [{"id": vid, "values": v, "metadata": m or {}} for vid, v, m in vectors]

    def _record_size_bytes(record: dict[str, Any]) -> int:
        # Approximate payload size to stay below Pinecone 4MB decoded message limit.
        return len(json.dumps(record, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))

    total_upserted = 0
    batch: list[dict[str, Any]] = []
    batch_bytes = 0

    pc = Pinecone(api_key=api_key)
    async with pc.IndexAsyncio(host=host) as idx:
        for rec in records:
            rec_bytes = _record_size_bytes(rec)
            should_flush = (
                batch
                and (
                    batch_bytes + rec_bytes > MAX_UPSERT_PAYLOAD_BYTES
                    or len(batch) >= MAX_UPSERT_BATCH_VECTORS
                )
            )
            if should_flush:
                result = await idx.upsert(vectors=batch, namespace=namespace or "")
                total_upserted += int(getattr(result, "upserted_count", len(batch)) or 0)
                batch = []
                batch_bytes = 0

            batch.append(rec)
            batch_bytes += rec_bytes

        if batch:
            result = await idx.upsert(vectors=batch, namespace=namespace or "")
            total_upserted += int(getattr(result, "upserted_count", len(batch)) or 0)

    return total_upserted


async def describe_index() -> dict[str, Any] | None:
    """
    Describe the configured index (control plane). Returns None if not configured.
    """
    if not is_configured():
        return None

    Pinecone = _get_pinecone()
    if not Pinecone:
        return None

    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX", "").strip() or None
    if not index_name:
        return None

    def _describe():
        pc = Pinecone(api_key=api_key)
        return pc.describe_index(index_name)

    try:
        desc = await asyncio.to_thread(_describe)
        return {
            "name": getattr(desc, "name", None),
            "host": getattr(desc, "host", None),
            "dimension": getattr(desc, "dimension", None),
            "metric": getattr(desc, "metric", None),
        }
    except Exception:
        return None
