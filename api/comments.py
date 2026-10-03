from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import select

import api.authentication as auth
import api.db as db


class CommentCreate(BaseModel):
    comment: str = Field(min_length=1, max_length=5000)


class CommentRead(BaseModel):
    id: int
    username: str
    comment: str
    created_at: datetime


router = APIRouter(prefix="/comments", tags=["Comment Operations"])


@router.post("/", response_model=CommentRead, status_code=201,
             summary="Adds a comment from the signed-in user")
async def create_comment(
    comment_data: CommentCreate,
    user: db.ApiUser = Depends(auth.get_authenticated_user),
    session: db.Session = Depends(db.get_write_session)
):
    comment_text = comment_data.comment.strip()
    if not comment_text:
        raise HTTPException(status_code=422, detail="Comment cannot be empty")
    comment = db.UserComment(user_id=user.id, comment=comment_text)
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return CommentRead(
        id=comment.id,
        username=user.username,
        comment=comment.comment,
        created_at=comment.created_at
    )


@router.get("/", response_model=list[CommentRead],
            summary="Lists comments for privileged users")
async def get_comments(
    user: db.ApiUser = Depends(auth.get_authorised_user),
    session: db.Session = Depends(db.get_readonly_session)
):
    statement = (
        select(db.UserComment, db.ApiUser.username)
        .join(db.ApiUser, db.ApiUser.id == db.UserComment.user_id)
        .order_by(db.UserComment.created_at.desc(), db.UserComment.id.desc())
    )
    return [
        CommentRead(
            id=comment.id,
            username=username,
            comment=comment.comment,
            created_at=comment.created_at
        )
        for comment, username in session.exec(statement).all()
    ]
