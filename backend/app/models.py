"""Database tables. Mirrors section 10 of the planning document."""
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Google Calendar OAuth tokens
    google_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_token_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    google_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    courses: Mapped[list["Course"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code: Mapped[str] = mapped_column(String(50))  # e.g. "CS 3345"
    name: Mapped[str] = mapped_column(String(255), default="")
    instructor: Mapped[str] = mapped_column(String(255), default="")
    semester: Mapped[str] = mapped_column(String(100), default="")
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="courses")
    syllabi: Mapped[list["Syllabus"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class Syllabus(Base):
    __tablename__ = "syllabi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    text: Mapped[str] = mapped_column(Text, default="")
    # uploaded -> processing -> review -> confirmed | failed
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    method: Mapped[str] = mapped_column(String(20), default="")  # "ai" or "rules"
    summary: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="syllabi")
    events: Mapped[list["Event"]] = relationship(back_populates="syllabus")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    syllabus_id: Mapped[int | None] = mapped_column(ForeignKey("syllabi.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(30), default="other")  # exam, quiz, homework, project, reading, other
    due_date: Mapped[date] = mapped_column(Date, index=True)
    due_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    weight: Mapped[str] = mapped_column(String(50), default="")  # e.g. "20%"
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    source_text: Mapped[str] = mapped_column(Text, default="")  # where it came from in the syllabus
    confidence: Mapped[float] = mapped_column(Float, default=1.0)  # 0..1 from the AI
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)  # reviewed by student

    google_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="events")
    syllabus: Mapped[Syllabus | None] = relationship(back_populates="events")
