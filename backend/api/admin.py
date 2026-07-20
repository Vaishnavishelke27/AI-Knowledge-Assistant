from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.dependencies import role_checker
from backend.core.auth import get_current_user
from backend.db.session import get_db
from backend.models.conversation import Conversation
from backend.models.document import Document
from backend.models.feedback import Feedback
from backend.models.message import Message
from backend.models.user import User, UserRole

router = APIRouter(tags=["feedback"])
admin_router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(role_checker(UserRole.ADMIN))],
)
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


class FeedbackRequest(BaseModel):
    message_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class FeedbackResponse(BaseModel):
    id: int
    message_id: int
    rating: int
    comment: str | None
    created_at: datetime


class QueryHistoryItem(BaseModel):
    conversation_id: int
    question: str
    answer: str
    message_id: int
    citations: list[dict[str, Any]]
    rating: int | None
    feedback_comment: str | None
    created_at: datetime


@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(
    payload: FeedbackRequest, db: DbSession, current_user: CurrentUser
) -> FeedbackResponse:
    message = db.scalar(
        select(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Message.id == payload.message_id,
            Message.role == "assistant",
            Conversation.user_id == current_user.id,
        )
    )
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant response not found",
        )

    feedback = db.scalar(
        select(Feedback).where(
            Feedback.message_id == message.id, Feedback.user_id == current_user.id
        )
    )
    if feedback is None:
        feedback = Feedback(
            message_id=message.id,
            user_id=current_user.id,
            rating=payload.rating,
            comment=payload.comment,
        )
        db.add(feedback)
    else:
        feedback.rating = payload.rating
        feedback.comment = payload.comment
    db.commit()
    db.refresh(feedback)
    return FeedbackResponse(
        id=feedback.id,
        message_id=feedback.message_id,
        rating=feedback.rating,
        comment=feedback.comment,
        created_at=feedback.created_at,
    )


@router.get("/query-history", response_model=list[QueryHistoryItem])
def query_history(db: DbSession, current_user: CurrentUser) -> list[QueryHistoryItem]:
    conversations = db.scalars(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
    ).all()
    feedback_by_message = {
        item.message_id: item
        for item in db.scalars(
            select(Feedback).where(Feedback.user_id == current_user.id)
        ).all()
    }
    history: list[QueryHistoryItem] = []
    for conversation in conversations:
        messages = db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at, Message.id)
        ).all()
        pending_question: Message | None = None
        for message in messages:
            if message.role == "user":
                pending_question = message
            elif message.role == "assistant" and pending_question is not None:
                feedback = feedback_by_message.get(message.id)
                history.append(
                    QueryHistoryItem(
                        conversation_id=conversation.id,
                        question=pending_question.content,
                        answer=message.content,
                        message_id=message.id,
                        citations=message.citations,
                        rating=feedback.rating if feedback else None,
                        feedback_comment=feedback.comment if feedback else None,
                        created_at=message.created_at,
                    )
                )
                pending_question = None
    return sorted(history, key=lambda item: item.created_at, reverse=True)


@admin_router.get("/stats")
def get_system_stats(db: DbSession) -> dict[str, int | float]:
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_documents = db.scalar(select(func.count(Document.id))) or 0
    total_queries = db.scalar(
        select(func.count(Message.id)).where(Message.role == "user")
    ) or 0
    average = db.scalar(
        select(func.avg(Message.response_time_ms)).where(
            Message.role == "assistant", Message.response_time_ms.is_not(None)
        )
    )
    return {
        "total_users": total_users,
        "total_documents": total_documents,
        "total_queries": total_queries,
        "avg_response_time_ms": round(float(average or 0), 2),
    }


@admin_router.get("/user-activity")
def get_user_activity(db: DbSession) -> list[dict[str, Any]]:
    activity_date = func.date(Message.created_at).label("activity_date")
    rows = db.execute(
        select(
            User.id,
            User.email,
            activity_date,
            func.count(Message.id).label("query_count"),
        )
        .join(Conversation, Conversation.user_id == User.id)
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Message.role == "user")
        .group_by(User.id, User.email, activity_date)
        .order_by(activity_date.desc(), User.email)
    ).all()
    return [
        {
            "user_id": row.id,
            "email": row.email,
            "date": str(row.activity_date),
            "query_count": row.query_count,
        }
        for row in rows
    ]


@admin_router.get("/document-usage")
def get_document_usage(db: DbSession) -> list[dict[str, Any]]:
    usage: dict[int, dict[str, Any]] = {}
    messages = db.scalars(select(Message).where(Message.role == "assistant")).all()
    for message in messages:
        for citation in message.citations:
            document_id = citation.get("document_id")
            if document_id is None:
                continue
            item = usage.setdefault(
                int(document_id),
                {
                    "document_id": int(document_id),
                    "filename": citation.get("filename", "Unknown document"),
                    "query_count": 0,
                },
            )
            item["query_count"] += 1
    return sorted(usage.values(), key=lambda item: item["query_count"], reverse=True)


@admin_router.get("/feedback-summary")
def get_feedback_summary(db: DbSession) -> dict[str, Any]:
    total = db.scalar(select(func.count(Feedback.id))) or 0
    average = db.scalar(select(func.avg(Feedback.rating)))
    rows = db.execute(
        select(Feedback.rating, func.count(Feedback.id)).group_by(Feedback.rating)
    ).all()
    distribution = {str(rating): 0 for rating in range(1, 6)}
    distribution.update({str(rating): count for rating, count in rows})
    return {
        "total_feedback": total,
        "average_rating": round(float(average or 0), 2),
        "rating_distribution": distribution,
    }
