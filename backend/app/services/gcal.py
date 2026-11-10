"""Google Calendar integration via OAuth 2.0 (web server flow) + Calendar REST API v3."""
from __future__ import annotations

from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Event, User

settings = get_settings()

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
SCOPES = "openid email https://www.googleapis.com/auth/calendar.events"

# Google Calendar colorId per event type (1-11 are Google's preset event colours)
TYPE_COLORS = {"exam": "11", "quiz": "6", "project": "3", "homework": "9", "reading": "2", "lab": "7", "presentation": "5"}


class GoogleError(Exception):
    pass


def build_auth_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",  # get a refresh token
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(user: User, code: str, db: Session) -> None:
    resp = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise GoogleError(f"Token exchange failed: {resp.text}")
    _store_tokens(user, resp.json())
    try:
        info = httpx.get(USERINFO_URL, headers={"Authorization": f"Bearer {user.google_access_token}"}, timeout=20)
        if info.status_code == 200:
            user.google_email = info.json().get("email")
    except httpx.HTTPError:
        pass
    db.commit()


def _store_tokens(user: User, tok: dict) -> None:
    user.google_access_token = tok["access_token"]
    if tok.get("refresh_token"):
        user.google_refresh_token = tok["refresh_token"]
    user.google_token_expiry = datetime.utcnow() + timedelta(seconds=int(tok.get("expires_in", 3600)) - 60)


def _access_token(user: User, db: Session) -> str:
    if not user.google_access_token:
        raise GoogleError("Google Calendar is not connected")
    if user.google_token_expiry and user.google_token_expiry > datetime.utcnow():
        return user.google_access_token
    if not user.google_refresh_token:
        raise GoogleError("Google session expired - please reconnect Google Calendar")
    resp = httpx.post(
        TOKEN_URL,
        data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": user.google_refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise GoogleError("Could not refresh Google token - please reconnect Google Calendar")
    _store_tokens(user, resp.json())
    db.commit()
    return user.google_access_token


def disconnect(user: User, db: Session) -> None:
    token = user.google_refresh_token or user.google_access_token
    if token:
        try:
            httpx.post("https://oauth2.googleapis.com/revoke", params={"token": token}, timeout=10)
        except httpx.HTTPError:
            pass
    user.google_access_token = user.google_refresh_token = user.google_email = None
    user.google_token_expiry = None
    db.commit()


def _event_body(ev: Event) -> dict:
    course = ev.course
    desc_parts = [f"Course: {course.code} {course.name}".strip(), f"Type: {ev.type}"]
    if ev.weight:
        desc_parts.append(f"Weight: {ev.weight}")
    if ev.description:
        desc_parts.append("", ev.description)
    desc_parts.append("", "Added by AI Syllabus Planner")
    body = {
        "summary": f"[{course.code}] {ev.title}",
        "description": "\n".join(desc_parts),
        "colorId": TYPE_COLORS.get(ev.type, "8"),
        "extendedProperties": {"private": {"syllabusPlannerId": str(ev.id)}},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 24 * 60}]},
    }
    if ev.due_time:
        start = datetime.combine(ev.due_date, ev.due_time)
        end = start + timedelta(hours=1)
        body["start"] = {"dateTime": start.isoformat(), "timeZone": settings.default_timezone}
        body["end"] = {"dateTime": end.isoformat(), "timeZone": settings.default_timezone}
    else:
        body["start"] = {"date": ev.due_date.isoformat()}
        body["end"] = {"date": (ev.due_date + timedelta(days=1)).isoformat()}
    return body


def push_event(user: User, ev: Event, db: Session) -> str:
    """Create or update one event on the user's primary Google Calendar. Returns 'created'/'updated'."""
    headers = {"Authorization": f"Bearer {_access_token(user, db)}"}
    body = _event_body(ev)
    if ev.google_event_id:
        resp = httpx.put(f"{CAL_BASE}/{ev.google_event_id}", json=body, headers=headers, timeout=20)
        if resp.status_code == 200:
            return "updated"
        if resp.status_code not in (404, 410):
            raise GoogleError(resp.text)
    resp = httpx.post(CAL_BASE, json=body, headers=headers, timeout=20)
    if resp.status_code not in (200, 201):
        raise GoogleError(resp.text)
    ev.google_event_id = resp.json()["id"]
    return "created"


def delete_event(user: User, ev: Event, db: Session) -> None:
    if not ev.google_event_id or not user.google_access_token:
        return
    try:
        headers = {"Authorization": f"Bearer {_access_token(user, db)}"}
        httpx.delete(f"{CAL_BASE}/{ev.google_event_id}", headers=headers, timeout=20)
    except (GoogleError, httpx.HTTPError):
        pass
