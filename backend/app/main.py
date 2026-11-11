import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .services import llm
from .routers import assistant, auth, courses, events, google, syllabi

logging.basicConfig(level=logging.INFO)
settings = get_settings()

Base.metadata.create_all(bind=engine)
settings.upload_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="AI Syllabus Planner API",
    description="Upload a syllabus, let AI find the deadlines, review them, and sync to Google Calendar.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url.rstrip("/"), "http://localhost:3000", "http://127.0.0.1:3000"],
    # This project's Vercel deployments (production + preview URLs), e.g.
    # https://ai-syllabus-planner.vercel.app, https://ai-syllabus-planner-git-main-xyz.vercel.app
    allow_origin_regex=r"https://ai-syllabus-planner[a-z0-9-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, courses.router, syllabi.router, events.router, google.router, assistant.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ai_enabled": settings.ai_enabled,
        "ai_providers": llm.providers(),
        "google_configured": settings.google_enabled,
    }
