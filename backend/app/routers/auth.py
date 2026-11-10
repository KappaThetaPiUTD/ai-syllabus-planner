from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, SignupIn, TokenOut, UserOut
from .common import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenOut)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Please enter a valid email")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(400, "An account with this email already exists")
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id), user=user_out(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return TokenOut(access_token=create_token(user.id), user=user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)
