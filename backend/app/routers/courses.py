from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Course, User
from ..schemas import CourseIn, CourseOut
from .common import get_course

router = APIRouter(prefix="/api/courses", tags=["courses"])


def course_out(c: Course) -> CourseOut:
    out = CourseOut.model_validate(c)
    out.event_count = len(c.events)
    out.syllabus_count = len(c.syllabi)
    return out


@router.get("", response_model=list[CourseOut])
def list_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    courses = db.scalars(select(Course).where(Course.user_id == user.id).order_by(Course.code)).all()
    return [course_out(c) for c in courses]


@router.post("", response_model=CourseOut)
def create_course(body: CourseIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = Course(user_id=user.id, **body.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course_out(course)


@router.get("/{course_id}", response_model=CourseOut)
def read_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return course_out(get_course(db, user, course_id))


@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int, body: CourseIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    course = get_course(db, user, course_id)
    for k, v in body.model_dump().items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return course_out(course)


@router.delete("/{course_id}")
def delete_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_course(db, user, course_id))
    db.commit()
    return {"ok": True}
