"""Pinecone status and vector ingestion/retrieval endpoints."""

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app.models.request_models import (
    PineconeIngestFolderRequest,
    PineconeIngestRequest,
    PineconeSearchRequest,
)
from app.services import embedding_service
from app.services import pinecone_service

router = APIRouter(prefix="/pinecone", tags=["pinecone"])


def _ensure_pinecone_and_embeddings_configured() -> None:
    if not pinecone_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pinecone is not configured. Set PINECONE_API_KEY and PINECONE_HOST.",
        )
    if not embedding_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Embeddings are not configured. Install local embedding dependencies.",
        )


@router.get("/status")
async def pinecone_status():
    """
    Returns whether Pinecone is configured and optional index info.
    Safe to call when Pinecone is not configured (returns configured: false).
    """
    configured = pinecone_service.is_configured()
    out = {
        "configured": configured,
        "embeddings": embedding_service.embedding_status(),
    }
    if configured:
        out["index_host_set"] = bool(pinecone_service.get_index_host())
        index_name = os.environ.get("PINECONE_INDEX", "").strip()
        if index_name:
            desc = await pinecone_service.describe_index()
            if desc:
                out["index"] = desc
                expected_dim = embedding_service.get_expected_dimension()
                actual_dim = desc.get("dimension")
                if expected_dim is not None and actual_dim is not None and expected_dim != actual_dim:
                    out["dimension_warning"] = (
                        f"Embedding dimension ({expected_dim}) does not match index dimension ({actual_dim})."
                    )
    return out


@router.post("/ingest")
async def ingest_text(request: PineconeIngestRequest):
    _ensure_pinecone_and_embeddings_configured()

    chunks = embedding_service.chunk_text(
        request.text,
        chunk_size=request.chunk_size,
        chunk_overlap=request.chunk_overlap,
    )
    if not chunks:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No chunks generated from text.")

    vectors = await embedding_service.embed_texts(chunks)
    records: list[tuple[str, list[float], dict | None]] = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors), start=1):
        chunk_metadata = {
            "doc_id": request.doc_id,
            "chunk_id": i,
            "text": chunk,
        }
        if request.module_id:
            chunk_metadata["module_id"] = request.module_id
        if request.topic:
            chunk_metadata["topic"] = request.topic
        if request.source_file:
            chunk_metadata["source_file"] = request.source_file
        if request.metadata:
            chunk_metadata.update(request.metadata)

        records.append((f"{request.doc_id}:{i}", vector, chunk_metadata))

    upserted = await pinecone_service.upsert_vectors(records, namespace=request.namespace)
    return {
        "doc_id": request.doc_id,
        "namespace": request.namespace or "",
        "chunks_created": len(chunks),
        "vectors_upserted": upserted,
        "embedding_model": embedding_service.get_embedding_model(),
        "embedding_dimension": len(vectors[0]) if vectors else None,
    }


@router.post("/ingest-folder")
async def ingest_folder(request: PineconeIngestFolderRequest):
    _ensure_pinecone_and_embeddings_configured()

    folder = Path(request.folder_path).expanduser()
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Folder not found or not a directory: {request.folder_path}",
        )

    extensions = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in request.include_extensions}
    files = [
        p for p in sorted(folder.rglob("*"))
        if p.is_file() and p.suffix.lower() in extensions
    ][: request.max_files]

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No files found in {request.folder_path} matching {sorted(extensions)}",
        )

    total_chunks = 0
    total_upserted = 0
    processed: list[dict] = []
    skipped: list[dict] = []

    for file_path in files:
        text = ""
        try:
            if file_path.suffix.lower() == ".pdf":
                from pypdf import PdfReader
                reader = PdfReader(str(file_path))
                text = "\n".join((page.extract_text() or "") for page in reader.pages)
            else:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            skipped.append({"file": str(file_path), "reason": f"read_error: {exc}"})
            continue

        chunks = embedding_service.chunk_text(
            text,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )
        if not chunks:
            skipped.append({"file": str(file_path), "reason": "empty_or_unreadable_text"})
            continue

        vectors = await embedding_service.embed_texts(chunks)
        doc_id = file_path.stem
        source_rel = str(file_path.relative_to(folder))

        records: list[tuple[str, list[float], dict]] = []
        for i, (chunk, vector) in enumerate(zip(chunks, vectors), start=1):
            metadata = {
                "doc_id": doc_id,
                "chunk_id": i,
                "source_file": source_rel,
                "text": chunk,
            }
            if request.module_id:
                metadata["module_id"] = request.module_id
            if request.topic:
                metadata["topic"] = request.topic

            records.append((f"{doc_id}:{i}", vector, metadata))

        upserted = await pinecone_service.upsert_vectors(records, namespace=request.namespace)
        upserted_count = int(upserted or 0)
        total_chunks += len(chunks)
        total_upserted += upserted_count
        processed.append(
            {
                "file": source_rel,
                "doc_id": doc_id,
                "chunks_created": len(chunks),
                "vectors_upserted": upserted_count,
            }
        )

    return {
        "folder_path": str(folder),
        "namespace": request.namespace or "",
        "files_scanned": len(files),
        "files_processed": len(processed),
        "files_skipped": len(skipped),
        "total_chunks_created": total_chunks,
        "total_vectors_upserted": total_upserted,
        "embedding_model": embedding_service.get_embedding_model(),
        "embedding_dimension": embedding_service.get_expected_dimension(),
        "processed": processed,
        "skipped": skipped,
    }


@router.post("/search")
async def search_vectors(request: PineconeSearchRequest):
    _ensure_pinecone_and_embeddings_configured()

    vector = await embedding_service.embed_text(request.query)
    matches = await pinecone_service.query_vectors(
        vector=vector,
        top_k=request.top_k,
        namespace=request.namespace,
        filter_=request.filter,
        include_metadata=True,
        include_values=False,
    )
    return {
        "query": request.query,
        "top_k": request.top_k,
        "namespace": request.namespace or "",
        "matches": matches,
    }
