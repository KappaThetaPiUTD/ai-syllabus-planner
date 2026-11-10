"""Step 2 of the pipeline: turn syllabus text into structured events.

Two strategies:
  * AI - free Google Gemini (or Groq / optional Claude, see llm.py). Returns
    structured JSON matching a schema: event type, date, time, material covered,
    the source line, and a confidence score.
  * Rules - a regex fallback so the app still works with no API key.

Either way the results are saved as *unconfirmed* events that the student
reviews before they show up as final or get sent to Google Calendar.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from pathlib import Path

from dateutil import parser as dateparser

from ..config import get_settings
from . import llm

log = logging.getLogger(__name__)
settings = get_settings()

EVENT_TYPES = ["exam", "quiz", "homework", "project", "reading", "lab", "presentation", "other"]


@dataclass
class ExtractedEvent:
    title: str
    type: str
    due_date: date
    due_time: time | None = None
    description: str = ""
    weight: str = ""
    source_text: str = ""
    confidence: float = 0.5


@dataclass
class ExtractionResult:
    method: str
    events: list[ExtractedEvent] = field(default_factory=list)
    summary: str = ""
    course: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# AI extraction with Claude
# ---------------------------------------------------------------------------

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "course": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "name": {"type": "string"},
                "instructor": {"type": "string"},
                "semester": {"type": "string"},
            },
            "required": ["code", "name", "instructor", "semester"],
            "additionalProperties": False,
        },
        "summary": {"type": "string"},
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "type": {"type": "string", "enum": EVENT_TYPES},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time": {"type": "string", "description": "HH:MM 24h, or empty string if not stated"},
                    "description": {"type": "string"},
                    "weight": {"type": "string"},
                    "source_text": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["title", "type", "date", "time", "description", "weight", "source_text", "confidence"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["course", "summary", "events"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You extract a structured semester schedule from a college course syllabus.

Return every dated, gradeable or important item: exams, midterms, finals, quizzes, homework, \
problem sets, projects and their milestones, labs, presentations, papers, and assigned readings \
that have a specific date. Also include important dated course events such as "no class" days \
or add/drop deadlines, typed as "other".

Rules:
- Return structured data, not a summary of the PDF.
- date must be an ISO date (YYYY-MM-DD). If the syllabus omits the year, infer it from the \
semester/term stated in the syllabus or from the reference date you are given.
- If a schedule table gives "Week N" with no explicit date, only include it when the syllabus \
gives enough information (e.g. a semester start date) to compute the date; lower the confidence.
- time is 24-hour HH:MM if a due time is stated, otherwise an empty string.
- description holds what the item covers, e.g. "Chapters 1 through 5", or submission details.
- weight is the grade weight if stated (e.g. "20%"), otherwise an empty string.
- source_text is the exact short line or phrase from the syllabus the item came from.
- confidence is between 0 and 1: 0.9+ when the date is explicit and unambiguous, lower when \
you inferred the year, computed a date from a week number, or the text is unclear.
- Do not invent items. If something has no date, leave it out.
- summary: 2-3 sentences describing the course and how it is graded.
- course: fill in what the syllabus states; use empty strings for anything not stated."""


def _ai_extract(text: str, pdf_path: Path | None, reference_date: date, course_hint: str) -> ExtractionResult:
    pdf = pdf_path.read_bytes() if pdf_path is not None and pdf_path.suffix.lower() == ".pdf" else None
    prompt = (
        f"Reference date (today): {reference_date.isoformat()}\n"
        f"Course as entered by the student: {course_hint}\n\n"
        "Extract the schedule from this syllabus."
    )
    if pdf is None:  # .txt upload
        prompt = f"<syllabus>\n{text}\n</syllabus>\n\n" + prompt
    data, provider = llm.generate_json(SYSTEM_PROMPT, prompt, EXTRACTION_SCHEMA, pdf=pdf, pdf_text=text)

    events: list[ExtractedEvent] = []
    for item in data.get("events", []) or []:
        try:
            d = date.fromisoformat(str(item["date"])[:10])
        except (ValueError, KeyError, TypeError):
            continue
        t = None
        if item.get("time"):
            try:
                t = time.fromisoformat(str(item["time"])[:5])
            except ValueError:
                t = None
        etype = item.get("type") if item.get("type") in EVENT_TYPES else "other"
        try:
            conf = max(0.0, min(1.0, float(item.get("confidence", 0.5))))
        except (TypeError, ValueError):
            conf = 0.5
        events.append(
            ExtractedEvent(
                title=str(item.get("title", "")).strip()[:255] or "Untitled",
                type=etype,
                due_date=d,
                due_time=t,
                description=str(item.get("description", "") or ""),
                weight=str(item.get("weight", "") or "")[:50],
                source_text=str(item.get("source_text", "") or ""),
                confidence=conf,
            )
        )
    course = data.get("course") if isinstance(data.get("course"), dict) else {}
    return ExtractionResult(method=provider, events=events, summary=str(data.get("summary", "")), course=course)


# ---------------------------------------------------------------------------
# Rule-based fallback (no API key needed)
# ---------------------------------------------------------------------------

MONTHS = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
DATE_PATTERNS = [
    re.compile(rf"\b{MONTHS}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{4}})?\b", re.I),
    re.compile(r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b"),
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
]
TIME_PATTERN = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)", re.I)
KEYWORDS = [  # order matters: "Final Project" is a project, "Final Exam" is an exam
    ("project", r"\b(project|milestone|proposal)\b"),
    ("exam", r"\b(exam|midterm|final|test)\b"),
    ("quiz", r"\bquiz"),
    ("presentation", r"\bpresentation"),
    ("lab", r"\blab\b"),
    ("homework", r"\b(homework|hw\s?\d|assignment|problem set|pset|essay|paper)\b"),
    ("reading", r"\b(read|reading|chapter)\b"),
    ("other", r"\b(no class|holiday|break|last day|deadline|drop)\b"),
]


def _detect_year(text: str, reference_date: date) -> int:
    m = re.search(r"\b(Spring|Summer|Fall|Autumn|Winter)\s+(20\d{2})\b", text, re.I)
    if m:
        return int(m.group(2))
    m = re.search(r"\b(20\d{2})\b", text)
    return int(m.group(1)) if m else reference_date.year


def _rule_extract(text: str, reference_date: date) -> ExtractionResult:
    year = _detect_year(text, reference_date)
    default = datetime(year, 1, 1)
    events: list[ExtractedEvent] = []
    seen: set[tuple[str, date]] = set()

    for raw_line in text.splitlines():
        line = " ".join(raw_line.split())
        if len(line) < 4:
            continue
        etype = next((t for t, pat in KEYWORDS if re.search(pat, line, re.I)), None)
        if etype is None:
            continue
        for pat in DATE_PATTERNS:
            m = pat.search(line)
            if not m:
                continue
            try:
                d = dateparser.parse(m.group(0).replace(".", ""), default=default, fuzzy=True).date()
            except (ValueError, OverflowError):
                continue
            # Title = the line with the date removed, tidied up.
            title = (line[: m.start()] + line[m.end():]).strip(" -–—:|,\t")
            title = re.sub(r"\s{2,}", " ", title)[:120] or etype.title()
            t = None
            tm = TIME_PATTERN.search(line)
            if tm:
                hour = int(tm.group(1)) % 12 + (12 if tm.group(3).lower().startswith("p") else 0)
                t = time(hour, int(tm.group(2) or 0))
            key = (title.lower(), d)
            if key in seen:
                break
            seen.add(key)
            events.append(
                ExtractedEvent(
                    title=title,
                    type=etype,
                    due_date=d,
                    due_time=t,
                    source_text=line[:500],
                    confidence=0.55 if m.re is DATE_PATTERNS[0] else 0.4,
                )
            )
            break

    events.sort(key=lambda e: e.due_date)
    return ExtractionResult(
        method="rules",
        events=events,
        summary="Extracted with the built-in rule-based parser (add a free GEMINI_API_KEY for AI extraction). "
        "Please review every item carefully.",
    )


def extract_events(text: str, pdf_path: Path | None, reference_date: date, course_hint: str = "") -> ExtractionResult:
    if settings.ai_enabled:
        try:
            return _ai_extract(text, pdf_path, reference_date, course_hint)
        except Exception as exc:  # fall back rather than fail the upload
            log.warning("AI extraction failed, falling back to rules: %s", exc)
            if not text.strip():
                raise RuntimeError(f"AI extraction failed and the PDF has no selectable text: {exc}") from exc
            result = _rule_extract(text, reference_date)
            result.summary = f"AI extraction failed ({exc}); used the rule-based parser instead. " + result.summary
            return result
    if not text.strip():
        raise RuntimeError(
            "This PDF has no selectable text (it may be scanned). Add a free GEMINI_API_KEY so the AI can read scanned PDFs."
        )
    return _rule_extract(text, reference_date)
