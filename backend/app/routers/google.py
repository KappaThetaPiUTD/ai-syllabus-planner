from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_token, decode_token, get_current_user
from ..config import get_settings
from ..database import get_db
from ..models import Course, Event, User
from ..schemas import SyncIn, SyncOut
from ..services import gcal

router = APIRouter(prefix="/api/google", tags=["google"])
settings = get_settings()


@router.get("/status")
def status(user: User = Depends(get_current_user)):
    return {
        "configured": settings.google_enabled,
        "connected": bool(user.google_access_token),
        "email": user.google_email,
    }


@router.get("/auth-url")
def auth_url(user: User = Depends(get_current_user)):
    if not settings.google_enabled:
        raise HTTPException(400, "Google OAuth is not configured on the server (set GOOGLE_CLIENT_ID/SECRET).")
    # The state parameter carries a short-lived signed token so the callback knows which user it is.
    state = create_token(user.id, purpose="google_oauth", minutes=10)
    return {"url": gcal.build_auth_url(state)}


@router.get("/callback")
def callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    target = f"{settings.frontend_url}/settings"
    if error or not code or not state:
        return RedirectResponse(f"{target}?google=error&reason={error or 'missing_code'}")
    try:
        user = db.get(User, decode_token(state, purpose="google_oauth"))
        if user is None:
            raise HTTPException(400, "Unknown user")
        gcal.exchange_code(user, code, db)
    except (HTTPException, gcal.GoogleError):
        return RedirectResponse(f"{target}?google=error&reason=exchange_failed")
    return RedirectResponse(f"{target}?google=connected")


@router.post("/disconnect")
def disconnect(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gcal.disconnect(user, db)
    return {"ok": True}


@router.post("/sync", response_model=SyncOut)
def sync(body: SyncIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Push confirmed events to Google Calendar. Unreviewed AI guesses are never sent."""
    if not user.google_access_token:
        raise HTTPException(400, "Connect Google Calendar first")
    q = select(Event).join(Course).where(Course.user_id == user.id, Event.confirmed == True)  # noqa: E712
    if body.event_ids is not None:
        q = q.where(Event.id.in_(body.event_ids))
    else:
        q = q.where(Event.google_event_id.is_(None))
    result = SyncOut(created=0, updated=0, failed=0)
    for ev in db.scalars(q).all():
        try:
            outcome = gcal.push_event(user, ev, db)
            db.commit()
            if outcome == "created":
                result.created += 1
            else:
                result.updated += 1
        except gcal.GoogleError as exc:
            result.failed += 1
            if len(result.errors) < 5:
                result.errors.append(f"{ev.title}: {str(exc)[:200]}")
    return result
