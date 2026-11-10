"""Upload a syllabus -> extract text -> AI extraction -> student review -> confirm."""
import logging
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_settings
from ..database import SessionLocal, get_db
from ..models import Course, Event, Syllabus, User
from ..schemas import ConfirmIn, SyllabusDetail, SyllabusOut
from ..services.extractor import extract_events
from ..services.pdf import extract_text
from .common import event_out, get_course, get_syllabus

router = APIRouter(prefix="/api/syllabi", tags=["syllabi"])
settings = get_settings()
log = logging.getLogger(__name__)
MAX_BYTES = 20 * 1024 * 1024


def syllabus_out(s: Syllabus) -> SyllabusOut:
    out = SyllabusOut.model_validate(s)
    out.text_length = len(s.text or "")
    out.event_count = len(s.events)
    return out


def process_syllabus(syllabus_id: int) -> None:
    """Background job: read the PDF and extract events (own DB session)."""
    db = SessionLocal()
    try:
        s = db.get(Syllabus, syllabus_id)
        if s is None:
            return
        s.status = "processing"
        db.commit()
        path = Path(s.stored_path)
        try:
            s.text = extract_text(path)
            db.commit()
            course = s.course
            result = extract_events(s.text, path, date.today(), f"{course.code} {course.name}".strip())
        except Exception as exc:
            log.exception("Syllabus processing failed")
            s.status, s.error = "failed", str(exc)
            db.commit()
            return

        # Replace any earlier unconfirmed events from this syllabus (re-processing).
        for old in list(s.events):
            if not old.confirmed:
                db.delete(old)
        for ev in result.events:
            db.add(
                Event(
                    course_id=s.course_id,
                    syllabus_id=s.id,
                    title=ev.title,
                    type=ev.type,
                    due_date=ev.due_date,
                    due_time=ev.due_time,
                    description=ev.description,
                    weight=ev.weight,
                    source_text=ev.source_text,
                    confidence=ev.confidence,
                    confirmed=False,
                )
            )
        # Fill blank course details from what the AI read in the syllabus.
        course = s.course
        for field in ("name", "instructor", "semester"):
            if not getattr(course, field) and result.course.get(field):
                setattr(course, field, result.course[field][:255])
        s.method, s.summary, s.status, s.error = result.method, result.summary, "review", ""
        db.commit()
    finally:
        db.close()


@router.post("", response_model=SyllabusOut)
async def upload_syllabus(
    background: BackgroundTasks,
    course_id: int = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = get_course(db, user, course_id)
    name = file.filename or "syllabus.pdf"
    suffix = Path(name).suffix.lower()
    if suffix not in (".pdf", ".txt"):
        raise HTTPException(400, "Please upload a PDF (or .txt) file")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File is larger than 20 MB")
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    stored = settings.upload_dir / f"{uuid.uuid4().hex}{suffix}"
    stored.write_bytes(data)

    s = Syllabus(course_id=course.id, filename=name, stored_path=str(stored), status="uploaded")
    db.add(s)
    db.commit()
    db.refresh(s)
    background.add_task(process_syllabus, s.id)
    return syllabus_out(s)


@router.get("", response_model=list[SyllabusOut])
def list_syllabi(
    course_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    q = select(Syllabus).join(Course).where(Course.user_id == user.id)
    if course_id is not None:
        q = q.where(Syllabus.course_id == course_id)
    return [syllabus_out(s) for s in db.scalars(q.order_by(Syllabus.uploaded_at.desc())).all()]


@router.get("/{syllabus_id}", response_model=SyllabusDetail)
def read_syllabus(syllabus_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = get_syllabus(db, user, syllabus_id)
    out = SyllabusDetail(**syllabus_out(s).model_dump(), text=s.text)
    out.events = [event_out(e) for e in sorted(s.events, key=lambda e: e.due_date)]
    return out


@router.post("/{syllabus_id}/reprocess", response_model=SyllabusOut)
def reprocess(
    syllabus_id: int,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = get_syllabus(db, user, syllabus_id)
    s.status = "uploaded"
    db.commit()
    background.add_task(process_syllabus, s.id)
    return syllabus_out(s)


@router.post("/{syllabus_id}/confirm", response_model=SyllabusOut)
def confirm(
    syllabus_id: int, body: ConfirmIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    s = get_syllabus(db, user, syllabus_id)
    for e in s.events:
        if body.event_ids is None or e.id in body.event_ids:
            e.confirmed = True
    s.status = "confirmed"
    db.commit()
    db.refresh(s)
    return syllabus_out(s)


@router.delete("/{syllabus_id}")
def delete_syllabus(
    syllabus_id: int, delete_events: bool = True, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    s = get_syllabus(db, user, syllabus_id)
    for e in list(s.events):
        if delete_events:
            db.delete(e)
        else:
            e.syllabus_id = None
    Path(s.stored_path).unlink(missing_ok=True)
    db.delete(s)
    db.commit()
    return {"ok": True}
