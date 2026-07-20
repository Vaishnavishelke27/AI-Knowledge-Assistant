from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.auth import get_current_user
from backend.db.session import get_db
from backend.models.conversation import Conversation
from backend.models.message import Message
from backend.models.user import User
from backend.services.memory_service import memory_service

router = APIRouter(prefix="/conversations", tags=["conversations"])
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: list[dict[str, Any]]
    created_at: datetime


def _owned_conversation(
    conversation_id: int, db: Session, current_user: User
) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate, db: DbSession, current_user: CurrentUser
) -> ConversationResponse:
    title = (payload.title or "New conversation").strip() or "New conversation"
    conversation = Conversation(user_id=current_user.id, title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return ConversationResponse(
        id=conversation.id, title=conversation.title, created_at=conversation.created_at
    )


@router.get("", response_model=list[ConversationResponse])
def list_user_conversations(
    db: DbSession, current_user: CurrentUser
) -> list[ConversationResponse]:
    conversations = db.scalars(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
    ).all()
    return [
        ConversationResponse(id=item.id, title=item.title, created_at=item.created_at)
        for item in conversations
    ]


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_conversation_messages(
    conversation_id: int, db: DbSession, current_user: CurrentUser
) -> list[MessageResponse]:
    _owned_conversation(conversation_id, db, current_user)
    messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at, Message.id)
    ).all()
    return [
        MessageResponse(
            id=message.id,
            role=message.role,
            content=message.content,
            citations=message.citations,
            created_at=message.created_at,
        )
        for message in messages
    ]


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int, db: DbSession, current_user: CurrentUser
) -> None:
    conversation = _owned_conversation(conversation_id, db, current_user)
    db.delete(conversation)
    db.commit()
    memory_service.clear(conversation_id)

