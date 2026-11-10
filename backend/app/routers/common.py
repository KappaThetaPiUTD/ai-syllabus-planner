from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Course, Event, Syllabus, User
from ..schemas import EventOut, UserOut


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        google_connected=bool(user.google_access_token),
        google_email=user.google_email,
    )


def event_out(e: Event) -> EventOut:
    out = EventOut.model_validate(e)
    out.course_code = e.course.code
    out.course_color = e.course.color
    return out


def get_course(db: Session, user: User, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None or course.user_id != user.id:
        raise HTTPException(404, "Course not found")
    return course


def get_event(db: Session, user: User, event_id: int) -> Event:
    ev = db.get(Event, event_id)
    if ev is None or ev.course.user_id != user.id:
        raise HTTPException(404, "Event not found")
    return ev


def get_syllabus(db: Session, user: User, syllabus_id: int) -> Syllabus:
    s = db.get(Syllabus, syllabus_id)
    if s is None or s.course.user_id != user.id:
        raise HTTPException(404, "Syllabus not found")
    return s
