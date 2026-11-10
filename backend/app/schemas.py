from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EventType = Literal["exam", "quiz", "homework", "project", "reading", "lab", "presentation", "other"]


class SignupIn(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str
    google_connected: bool = False
    google_email: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CourseIn(BaseModel):
    code: str
    name: str = ""
    instructor: str = ""
    semester: str = ""
    color: str = "#6366f1"


class CourseOut(CourseIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_count: int = 0
    syllabus_count: int = 0


class EventIn(BaseModel):
    course_id: int
    title: str
    type: EventType = "other"
    due_date: date
    due_time: time | None = None
    description: str = ""
    weight: str = ""
    completed: bool = False
    confirmed: bool = True


class EventUpdate(BaseModel):
    title: str | None = None
    type: EventType | None = None
    due_date: date | None = None
    due_time: time | None = None
    description: str | None = None
    weight: str | None = None
    completed: bool | None = None
    confirmed: bool | None = None
    course_id: int | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    course_id: int
    syllabus_id: int | None
    title: str
    type: str
    due_date: date
    due_time: time | None
    description: str
    weight: str
    completed: bool
    source_text: str
    confidence: float
    confirmed: bool
    google_event_id: str | None
    course_code: str = ""
    course_color: str = ""


class SyllabusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    course_id: int
    filename: str
    status: str
    method: str
    summary: str
    error: str
    uploaded_at: datetime
    text_length: int = 0
    event_count: int = 0


class SyllabusDetail(SyllabusOut):
    text: str = ""
    events: list[EventOut] = []


class ConfirmIn(BaseModel):
    event_ids: list[int] | None = None  # None = confirm all


class AskIn(BaseModel):
    question: str


class AskOut(BaseModel):
    answer: str
    method: str
    events: list[EventOut] = []


class SyncIn(BaseModel):
    event_ids: list[int] | None = None  # None = all confirmed, unsynced events


class SyncOut(BaseModel):
    created: int
    updated: int
    failed: int
    errors: list[str] = []
