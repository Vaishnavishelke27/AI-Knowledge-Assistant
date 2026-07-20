import json
from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core.auth import get_current_user
from backend.db.session import get_db
from backend.models.conversation import Conversation
from backend.models.message import Message
from backend.models.user import User
from backend.services.rag_engine import RAGResult, retrieval_qa_chain

router = APIRouter(tags=["query"])
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=10_000)
    conversation_id: int | None = None
    top_k: int = Field(default=5, ge=1, le=20)
    stream: bool = False


class AskResponse(BaseModel):
    answer: str
    citations: list[dict[str, Any]]
    conversation_id: int


def _stream_result(result: RAGResult, conversation_id: int) -> Iterator[str]:
    for start in range(0, len(result.answer), 120):
        data = json.dumps({"text": result.answer[start : start + 120]})
        yield f"event: answer\ndata: {data}\n\n"
    yield f"event: citations\ndata: {json.dumps(result.citations)}\n\n"
    yield f"event: conversation\ndata: {json.dumps({'conversation_id': conversation_id})}\n\n"
    yield "event: done\ndata: {}\n\n"


@router.post("/ask", response_model=None)
def ask(
    payload: AskRequest, db: DbSession, current_user: CurrentUser
) -> AskResponse | StreamingResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question cannot be blank",
        )

    if payload.conversation_id is None:
        conversation = Conversation(user_id=current_user.id, title=question[:255])
        db.add(conversation)
        db.flush()
    else:
        conversation = db.get(Conversation, payload.conversation_id)
        if conversation is None or conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

    db.add(
        Message(
            conversation_id=conversation.id,
            role="user",
            content=question,
            citations=[],
        )
    )
    try:
        result = retrieval_qa_chain(question, top_k=payload.top_k)
        db.add(
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content=result.answer,
                citations=result.citations,
            )
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The knowledge assistant is temporarily unavailable",
        ) from exc

    if payload.stream:
        return StreamingResponse(
            _stream_result(result, conversation.id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    return AskResponse(
        answer=result.answer,
        citations=result.citations,
        conversation_id=conversation.id,
    )

