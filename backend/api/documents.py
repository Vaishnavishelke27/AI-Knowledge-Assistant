import shutil
from datetime import datetime
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.api.dependencies import role_checker
from backend.core.auth import get_current_user
from backend.db.session import get_db
from backend.models.document import Document
from backend.models.user import User, UserRole
from backend.services.document_processor import PARSERS, process_document

router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = Path("uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Uploader = Annotated[
    User, Depends(role_checker(UserRole.ADMIN, UserRole.EDITOR))
]
AdminUser = Annotated[User, Depends(role_checker(UserRole.ADMIN))]


class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    uploader_id: int
    status: str
    chunk_count: int
    created_at: datetime


def serialize_document(document: Document) -> DocumentResponse:
    return DocumentResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        uploader_id=document.uploader_id,
        status=document.status,
        chunk_count=len(document.chunks),
        created_at=document.created_at,
    )


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: Annotated[UploadFile, File(...)], db: DbSession, current_user: Uploader
) -> DocumentResponse:
    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()
    if not original_name or extension not in PARSERS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Supported file types: {', '.join(sorted(PARSERS))}",
        )

    stored_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"
    try:
        with stored_path.open("wb") as destination:
            shutil.copyfileobj(file.file, destination)
        chunks = process_document(stored_path)
        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The document contains no extractable text",
            )

        document = Document(
            filename=original_name,
            file_type=extension,
            storage_path=str(stored_path),
            uploader_id=current_user.id,
            status="processed",
            chunks=[chunk.to_dict() for chunk in chunks],
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        return serialize_document(document)
    except HTTPException:
        stored_path.unlink(missing_ok=True)
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the processed document",
        ) from exc
    except Exception as exc:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The document could not be processed",
        ) from exc
    finally:
        file.file.close()


@router.get("", response_model=list[DocumentResponse])
def list_documents(db: DbSession, current_user: CurrentUser) -> list[DocumentResponse]:
    del current_user
    documents = db.scalars(select(Document).order_by(Document.created_at.desc())).all()
    return [serialize_document(document) for document in documents]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, db: DbSession, current_user: AdminUser) -> None:
    del current_user
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    stored_path = Path(document.storage_path).resolve()
    db.delete(document)
    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete document",
        ) from exc

    if stored_path.is_relative_to(UPLOAD_DIR):
        stored_path.unlink(missing_ok=True)
