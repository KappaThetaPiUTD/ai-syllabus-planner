"""Password hashing + JWT login tokens (no third-party auth service needed)."""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

settings = get_settings()
bearer = HTTPBearer(auto_error=False)
ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def create_token(user_id: int, purpose: str = "access", minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes or settings.access_token_minutes)
    return jwt.encode({"sub": str(user_id), "purpose": purpose, "exp": expire}, settings.secret_key, algorithm="HS256")


def decode_token(token: str, purpose: str = "access") -> int:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if payload.get("purpose") != purpose:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    return int(payload["sub"])


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    user = db.get(User, decode_token(creds.credentials))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user
