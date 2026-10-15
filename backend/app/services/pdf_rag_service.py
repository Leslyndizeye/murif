"""Lightweight PDF RAG utilities for chatbot context retrieval."""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - handled at runtime
    PdfReader = None


@dataclass
class PdfChunk:
    source: str
    chunk_id: str
    text: str


class PdfRagService:
    """Builds a simple in-memory index from local PDF files."""

    def __init__(self) -> None:
        self._cache_signature = ""
        self._cached_chunks: list[PdfChunk] = []
        self._last_error = ""

    def status(self) -> dict[str, Any]:
        return {
            "pdf_dir": settings.rag_pdf_dir,
            "available": PdfReader is not None,
            "reason": "ok" if PdfReader is not None else "pypdf_missing",
            "last_error": self._last_error,
            "indexed_chunks": len(self._cached_chunks),
        }

    def retrieve(self, question: str, top_k: int | None = None) -> list[dict[str, str]]:
        chunks = self._ensure_index()
        if not chunks:
            return []

        query_tokens = self._tokenize(question)
        if not query_tokens:
            limit = top_k or settings.rag_top_k
            return [self._to_dict(chunk) for chunk in chunks[:limit]]

        scored: list[tuple[int, PdfChunk]] = []
        for chunk in chunks:
            chunk_tokens = self._tokenize(chunk.text)
            overlap = len(query_tokens.intersection(chunk_tokens))
            if overlap <= 0:
                continue
            scored.append((overlap, chunk))

        if not scored:
            return []

        scored.sort(key=lambda item: item[0], reverse=True)
        limit = top_k or settings.rag_top_k
        return [self._to_dict(chunk) for _, chunk in scored[:limit]]

    def _ensure_index(self) -> list[PdfChunk]:
        pdf_dir = Path(settings.rag_pdf_dir)
        if not pdf_dir.exists() or not pdf_dir.is_dir():
            self._last_error = f"pdf_dir_not_found: {pdf_dir}"
            self._cached_chunks = []
            self._cache_signature = ""
            return []

        pdf_files = sorted(pdf_dir.glob("*.pdf"))
        if not pdf_files:
            self._last_error = f"no_pdfs_found_in: {pdf_dir}"
            self._cached_chunks = []
            self._cache_signature = ""
            return []

        signature = "|".join(f"{file.name}:{file.stat().st_mtime_ns}:{file.stat().st_size}" for file in pdf_files)
        if signature == self._cache_signature and self._cached_chunks:
            return self._cached_chunks

        built_chunks: list[PdfChunk] = []
        for pdf_file in pdf_files:
            built_chunks.extend(self._extract_chunks_from_pdf(pdf_file))

        self._cached_chunks = built_chunks
        self._cache_signature = signature
        self._last_error = ""
        return self._cached_chunks

    def _extract_chunks_from_pdf(self, pdf_file: Path) -> list[PdfChunk]:
        if PdfReader is None:
            self._last_error = "pypdf_missing"
            return []

        try:
            reader = PdfReader(str(pdf_file))
        except Exception as error:  # pragma: no cover - depends on external pdf files
            self._last_error = f"pdf_read_error:{pdf_file.name}:{error}"
            return []

        full_text_parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                full_text_parts.append(text)

        merged_text = "\n".join(full_text_parts).strip()
        if not merged_text:
            return []

        chunks: list[PdfChunk] = []
        chunk_size = max(300, settings.rag_chunk_size)
        overlap = min(max(0, settings.rag_chunk_overlap), chunk_size // 2)

        start = 0
        index = 1
        length = len(merged_text)
        while start < length:
            end = min(length, start + chunk_size)
            chunk_text = merged_text[start:end].strip()
            if chunk_text:
                chunks.append(
                    PdfChunk(
                        source=pdf_file.name,
                        chunk_id=f"{pdf_file.stem}#chunk{index}",
                        text=chunk_text,
                    )
                )
                index += 1

            if end == length:
                break
            start = max(0, end - overlap)

        return chunks

    @staticmethod
    def _tokenize(value: str) -> set[str]:
        return {token for token in re.findall(r"[a-zA-Z0-9_]+", (value or "").lower()) if len(token) > 1}

    @staticmethod
    def _to_dict(chunk: PdfChunk) -> dict[str, str]:
        return {
            "id": chunk.chunk_id,
            "type": "pdf",
            "text": chunk.text,
            "source": chunk.source,
        }


pdf_rag_service = PdfRagService()
