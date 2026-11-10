from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Course, Event, User
from ..schemas import EventIn, EventOut, EventUpdate
from ..services import gcal
from .common import event_out, get_course, get_event

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    start: date | None = None,
    end: date | None = None,
    course_id: int | None = None,
    type: str | None = None,
    confirmed: bool | None = None,
    completed: bool | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = select(Event).join(Course).where(Course.user_id == user.id)
    if start:
        q = q.where(Event.due_date >= start)
    if end:
        q = q.where(Event.due_date <= end)
    if course_id:
        q = q.where(Event.course_id == course_id)
    if type:
        q = q.where(Event.type == type)
    if confirmed is not None:
        q = q.where(Event.confirmed == confirmed)
    if completed is not None:
        q = q.where(Event.completed == completed)
    events = db.scalars(q.order_by(Event.due_date, Event.due_time)).all()
    return [event_out(e) for e in events]


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Dashboard numbers + the 'workload view' (events per week)."""
    events = db.scalars(select(Event).join(Course).where(Course.user_id == user.id, Event.confirmed == True)).all()  # noqa: E712
    today = date.today()
    week_end = today + timedelta(days=7)
    weeks: dict[str, dict] = {}
    for e in events:
        monday = e.due_date - timedelta(days=e.due_date.weekday())
        w = weeks.setdefault(monday.isoformat(), {"week_start": monday.isoformat(), "count": 0, "exams": 0, "load": 0})
        w["count"] += 1
        w["exams"] += e.type == "exam"
        w["load"] += {"exam": 5, "project": 4, "presentation": 3, "quiz": 2, "homework": 2, "lab": 2}.get(e.type, 1)
    pending = db.scalar(
        select(Event.id).join(Course).where(Course.user_id == user.id, Event.confirmed == False).limit(1)  # noqa: E712
    )
    return {
        "total": len(events),
        "completed": sum(e.completed for e in events),
        "due_this_week": sum(today <= e.due_date <= week_end and not e.completed for e in events),
        "overdue": sum(e.due_date < today and not e.completed for e in events),
        "upcoming_exams": sum(e.type == "exam" and e.due_date >= today for e in events),
        "needs_review": pending is not None,
        "weeks": sorted(weeks.values(), key=lambda w: w["week_start"]),
    }


@router.post("", response_model=EventOut)
def create_event(body: EventIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_course(db, user, body.course_id)
    ev = Event(**body.model_dump(), confidence=1.0, source_text="Added manually")
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return event_out(ev)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int, body: EventUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    ev = get_event(db, user, event_id)
    changes = body.model_dump(exclude_unset=True)
    if "course_id" in changes:
        get_course(db, user, changes["course_id"])
    for k, v in changes.items():
        setattr(ev, k, v)
    # An edit by the student counts as a review.
    if set(changes) - {"completed", "confirmed"}:
        ev.confidence = 1.0
    db.commit()
    db.refresh(ev)
    # Keep Google Calendar in sync if this event was already pushed.
    if ev.google_event_id and user.google_access_token:
        try:
            gcal.push_event(user, ev, db)
            db.commit()
        except gcal.GoogleError:
            pass
    return event_out(ev)


@router.delete("/{event_id}")
def delete_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ev = get_event(db, user, event_id)
    gcal.delete_event(user, ev, db)
    db.delete(ev)
    db.commit()
    return {"ok": True}
