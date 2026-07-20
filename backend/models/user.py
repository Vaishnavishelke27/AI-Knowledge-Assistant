from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class UserRole(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role", values_callable=lambda enum: [item.value for item in enum]),
        default=UserRole.VIEWER,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="uploader")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")


from backend.models.conversation import Conversation  # noqa: E402
from backend.models.document import Document  # noqa: E402

