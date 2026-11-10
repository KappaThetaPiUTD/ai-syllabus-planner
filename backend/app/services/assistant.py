""""What do I have due next week?" - answers questions about the student's deadlines."""
from __future__ import annotations

import json
import re
from datetime import date, timedelta

from ..config import get_settings
from ..models import Event
from . import llm

settings = get_settings()

SYSTEM = """You are a helpful study assistant inside the AI Syllabus Planner app. You answer the \
student's questions about their deadlines, exams and workload using ONLY the event list provided \
(JSON). Today's date is given. Be concise and friendly; use short bullet lists with dates \
(e.g. "Mon Oct 8 - CS 3345 Exam 1"). If something isn't in the data, say so. When asked for a \
study plan, propose concrete daily study blocks leading up to the relevant exams."""


def _event_dict(e: Event) -> dict:
    return {
        "course": e.course.code,
        "title": e.title,
        "type": e.type,
        "date": e.due_date.isoformat(),
        "weekday": e.due_date.strftime("%A"),
        "time": e.due_time.strftime("%H:%M") if e.due_time else "",
        "description": e.description,
        "weight": e.weight,
        "completed": e.completed,
    }


def _window(question: str, today: date) -> tuple[date, date] | None:
    q = question.lower()
    monday = today - timedelta(days=today.weekday())
    if "next week" in q:
        return monday + timedelta(days=7), monday + timedelta(days=13)
    if "this week" in q:
        return today, monday + timedelta(days=6)
    if "tomorrow" in q:
        return today + timedelta(days=1), today + timedelta(days=1)
    if "today" in q:
        return today, today
    if "this month" in q:
        nxt = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        return today, nxt - timedelta(days=1)
    m = re.search(r"next (\d+) days", q)
    if m:
        return today, today + timedelta(days=int(m.group(1)))
    return None


def _rules_answer(question: str, events: list[Event], today: date) -> tuple[str, list[Event]]:
    q = question.lower()
    window = _window(question, today)
    pool = [e for e in events if not e.completed]
    for t in ["exam", "quiz", "project", "homework", "reading", "lab"]:
        if t in q:
            pool = [e for e in pool if e.type == t]
            break
    if window:
        start, end = window
        pool = [e for e in pool if start <= e.due_date <= end]
        label = f"between {start:%a %b %d} and {end:%a %b %d}"
    else:
        pool = [e for e in pool if e.due_date >= today][:10]
        label = "coming up next"
    if not pool:
        return f"You have nothing {label}. 🎉", []
    lines = [f"Here's what you have {label}:"]
    for e in pool:
        when = e.due_date.strftime("%a %b %d") + (f" at {e.due_time:%I:%M %p}" if e.due_time else "")
        lines.append(f"• {when} - {e.course.code}: {e.title} ({e.type})")
    return "\n".join(lines), pool


def answer(question: str, events: list[Event], today: date | None = None) -> tuple[str, str, list[Event]]:
    today = today or date.today()
    events = sorted(events, key=lambda e: (e.due_date, e.due_time.isoformat() if e.due_time else ""))
    if not settings.ai_enabled:
        text, related = _rules_answer(question, events, today)
        return text, "rules", related

    payload = json.dumps([_event_dict(e) for e in events], indent=0)
    prompt = f"Today is {today:%A, %Y-%m-%d}.\n\n<events>\n{payload}\n</events>\n\nQuestion: {question}"
    try:
        text, provider = llm.generate_text(SYSTEM, prompt)
    except llm.LLMError:
        text, related = _rules_answer(question, events, today)
        return text, "rules", related
    _, related = _rules_answer(question, events, today)
    return text, provider, related
