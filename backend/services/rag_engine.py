import json
import os
from dataclasses import asdict, dataclass
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from langchain_core.prompts import PromptTemplate
from openai import OpenAI

from backend.core.config import settings
from backend.services.vector_store import search_similar

RAG_PROMPT = PromptTemplate.from_template(
    """You are an enterprise knowledge assistant. Answer only from the supplied context.
If the context does not contain the answer, say that you do not have enough information.
Cite factual statements using the context labels exactly as [1], [2], and so on.

Context:
{context}

Question: {question}

Answer:"""
)


class RAGEngineError(RuntimeError):
    """Raised when no configured language model can generate an answer."""


@dataclass(frozen=True, slots=True)
class Citation:
    id: int
    filename: str
    page: int | None
    slide: int | None
    chunk_index: int | None
    score: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class RAGResult:
    answer: str
    citations: list[dict[str, Any]]


def _location(citation: Citation) -> str:
    if citation.page is not None:
        return f"page {citation.page}"
    if citation.slide is not None:
        return f"slide {citation.slide}"
    return f"chunk {citation.chunk_index}" if citation.chunk_index is not None else "document"


def format_answer(answer: str, citations: list[Citation]) -> str:
    cleaned = answer.strip()
    if not citations:
        return cleaned
    missing_markers = [
        f"[{citation.id}]" for citation in citations if f"[{citation.id}]" not in cleaned
    ]
    if missing_markers:
        cleaned = f"{cleaned} {' '.join(missing_markers)}"
    references = "\n".join(
        f"[{citation.id}] {citation.filename}, {_location(citation)}"
        for citation in citations
    )
    return f"{cleaned}\n\nReferences:\n{references}"


class RAGEngine:
    def __init__(self) -> None:
        self.openai_model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")

    @staticmethod
    def _openai_is_configured() -> bool:
        key = settings.openai_api_key.strip()
        return bool(key and not key.lower().startswith(("your-", "replace-")))

    def _openai_completion(self, prompt: str) -> str:
        response = OpenAI(api_key=settings.openai_api_key).chat.completions.create(
            model=self.openai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        content = response.choices[0].message.content
        if not content:
            raise RAGEngineError("OpenAI returned an empty response")
        return content

    def _ollama_completion(self, prompt: str) -> str:
        body = json.dumps(
            {
                "model": self.ollama_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            }
        ).encode("utf-8")
        request = Request(
            self.ollama_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, URLError, ValueError) as exc:
            raise RAGEngineError("Ollama is unavailable") from exc
        content = payload.get("message", {}).get("content", "").strip()
        if not content:
            raise RAGEngineError("Ollama returned an empty response")
        return content

    def _generate(self, prompt: str) -> str:
        provider = os.getenv("LLM_PROVIDER", "auto").lower()
        if provider != "ollama" and self._openai_is_configured():
            try:
                return self._openai_completion(prompt)
            except Exception:
                if provider == "openai":
                    raise
        return self._ollama_completion(prompt)

    def retrieval_qa_chain(self, question: str, top_k: int = 5) -> RAGResult:
        results = search_similar(question, top_k=top_k)
        if not results:
            return RAGResult(
                answer="I do not have enough information in the knowledge base to answer that question.",
                citations=[],
            )

        citations: list[Citation] = []
        context_parts: list[str] = []
        for index, result in enumerate(results, start=1):
            metadata = result.get("metadata") or {}
            citation = Citation(
                id=index,
                filename=str(metadata.get("filename") or metadata.get("source") or "Unknown document"),
                page=metadata.get("page"),
                slide=metadata.get("slide"),
                chunk_index=metadata.get("chunk_index"),
                score=float(result.get("score", 0.0)),
            )
            citations.append(citation)
            context_parts.append(
                f"[{index}] Source: {citation.filename}, {_location(citation)}\n{result.get('text', '')}"
            )

        prompt = RAG_PROMPT.format(context="\n\n".join(context_parts), question=question)
        answer = format_answer(self._generate(prompt), citations)
        return RAGResult(answer=answer, citations=[citation.to_dict() for citation in citations])


rag_engine = RAGEngine()


def retrieval_qa_chain(question: str, top_k: int = 5) -> RAGResult:
    return rag_engine.retrieval_qa_chain(question, top_k)
