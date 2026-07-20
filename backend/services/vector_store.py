import os
from collections.abc import Iterable, Sequence
from threading import Lock
from typing import Any
from uuid import NAMESPACE_URL, uuid5

import chromadb
from openai import OpenAI
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer

from backend.core.config import settings
from backend.services.document_processor import DocumentChunk

COLLECTION_NAME = "knowledge_base"
DEFAULT_MODEL = "all-MiniLM-L6-v2"
OPENAI_MODEL = "text-embedding-3-small"


class EmbeddingService:
    def __init__(self) -> None:
        self.provider = os.getenv("EMBEDDING_PROVIDER", "sentence-transformers").lower()
        self._model: SentenceTransformer | None = None
        self._openai: OpenAI | None = None
        self._lock = Lock()

    def _sentence_model(self) -> SentenceTransformer:
        if self._model is None:
            with self._lock:
                if self._model is None:
                    self._model = SentenceTransformer(DEFAULT_MODEL)
        return self._model

    def _openai_client(self) -> OpenAI:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai")
        if self._openai is None:
            self._openai = OpenAI(api_key=settings.openai_api_key)
        return self._openai

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.provider == "openai":
            response = self._openai_client().embeddings.create(
                model=OPENAI_MODEL, input=list(texts)
            )
            return [item.embedding for item in response.data]
        vectors = self._sentence_model().encode(
            list(texts), normalize_embeddings=True, convert_to_numpy=True
        )
        return vectors.tolist()


class VectorStore:
    def __init__(self, embedding_service: EmbeddingService | None = None) -> None:
        self.embeddings = embedding_service or EmbeddingService()
        self._backend: str | None = None
        self._qdrant: QdrantClient | None = None
        self._chroma: Any = None

    def _ensure_backend(self, vector_size: int) -> str:
        if self._backend is not None:
            return self._backend
        try:
            client = QdrantClient(url=settings.qdrant_url, timeout=2)
            if not client.collection_exists(COLLECTION_NAME):
                client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=models.VectorParams(
                        size=vector_size, distance=models.Distance.COSINE
                    ),
                )
            self._qdrant = client
            self._backend = "qdrant"
        except Exception:
            client = chromadb.PersistentClient(path="uploads/.chroma")
            self._chroma = client.get_or_create_collection(
                name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
            )
            self._backend = "chroma"
        return self._backend

    @staticmethod
    def _payload(document_id: int, chunk: DocumentChunk) -> dict[str, Any]:
        metadata = {key: value for key, value in chunk.metadata.items() if value is not None}
        return {
            **metadata,
            "text": chunk.text,
            "document_id": document_id,
            "filename": metadata.get("source", ""),
        }

    def store_chunks(self, document_id: int, chunks: Sequence[DocumentChunk]) -> int:
        if not chunks:
            return 0
        vectors = self.embeddings.embed([chunk.text for chunk in chunks])
        backend = self._ensure_backend(len(vectors[0]))
        ids = [str(uuid5(NAMESPACE_URL, f"document:{document_id}:chunk:{index}")) for index in range(len(chunks))]
        payloads = [self._payload(document_id, chunk) for chunk in chunks]

        if backend == "qdrant":
            assert self._qdrant is not None
            self._qdrant.upsert(
                collection_name=COLLECTION_NAME,
                points=[
                    models.PointStruct(id=point_id, vector=vector, payload=payload)
                    for point_id, vector, payload in zip(ids, vectors, payloads, strict=True)
                ],
                wait=True,
            )
        else:
            self._chroma.upsert(
                ids=ids,
                embeddings=vectors,
                documents=[chunk.text for chunk in chunks],
                metadatas=payloads,
            )
        return len(chunks)

    def search_similar(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        if top_k < 1:
            raise ValueError("top_k must be at least 1")
        vector = self.embeddings.embed([query])[0]
        backend = self._ensure_backend(len(vector))
        if backend == "qdrant":
            assert self._qdrant is not None
            points = self._qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=vector,
                limit=top_k,
                with_payload=True,
            ).points
            return [
                {
                    "score": point.score,
                    "text": (point.payload or {}).get("text", ""),
                    "metadata": point.payload or {},
                }
                for point in points
            ]

        result = self._chroma.query(
            query_embeddings=[vector], n_results=top_k, include=["documents", "metadatas", "distances"]
        )
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        return [
            {"score": 1.0 - distance, "text": text, "metadata": metadata}
            for text, metadata, distance in zip(documents, metadatas, distances, strict=True)
        ]

    def delete_document(self, document_id: int) -> None:
        if self._backend == "qdrant" and self._qdrant is not None:
            self._qdrant.delete(
                collection_name=COLLECTION_NAME,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id", match=models.MatchValue(value=document_id)
                            )
                        ]
                    )
                ),
                wait=True,
            )
        elif self._backend == "chroma" and self._chroma is not None:
            self._chroma.delete(where={"document_id": document_id})

    def recreate_index(
        self, documents: Iterable[tuple[int, Sequence[DocumentChunk]]]
    ) -> int:
        prepared = list(documents)
        all_chunks = [chunk for _, chunks in prepared for chunk in chunks]
        if not all_chunks:
            try:
                client = QdrantClient(url=settings.qdrant_url, timeout=2)
                if client.collection_exists(COLLECTION_NAME):
                    client.delete_collection(COLLECTION_NAME)
            except Exception:
                client = chromadb.PersistentClient(path="uploads/.chroma")
                try:
                    client.delete_collection(COLLECTION_NAME)
                except Exception:
                    pass
            self._qdrant = self._chroma = self._backend = None
            return 0
        sample_vector = self.embeddings.embed([all_chunks[0].text])[0]

        try:
            client = QdrantClient(url=settings.qdrant_url, timeout=2)
            if client.collection_exists(COLLECTION_NAME):
                client.delete_collection(COLLECTION_NAME)
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=len(sample_vector), distance=models.Distance.COSINE
                ),
            )
            self._qdrant, self._chroma, self._backend = client, None, "qdrant"
        except Exception:
            client = chromadb.PersistentClient(path="uploads/.chroma")
            try:
                client.delete_collection(COLLECTION_NAME)
            except Exception:
                pass
            self._chroma = client.create_collection(
                name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
            )
            self._qdrant, self._backend = None, "chroma"

        return sum(self.store_chunks(document_id, chunks) for document_id, chunks in prepared)


vector_store = VectorStore()


def store_chunks(document_id: int, chunks: Sequence[DocumentChunk]) -> int:
    return vector_store.store_chunks(document_id, chunks)


def search_similar(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    return vector_store.search_similar(query, top_k)
