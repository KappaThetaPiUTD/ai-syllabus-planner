from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Course, Event, User
from ..schemas import AskIn, AskOut
from ..services import assistant
from .common import event_out

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/ask", response_model=AskOut)
def ask(body: AskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = db.scalars(
        select(Event).join(Course).where(Course.user_id == user.id, Event.confirmed == True)  # noqa: E712
    ).all()
    text, method, related = assistant.answer(body.question, list(events))
    return AskOut(answer=text, method=method, events=[event_out(e) for e in related[:15]])
