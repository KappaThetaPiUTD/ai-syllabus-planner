# AI Syllabus Planner

Upload a college syllabus. AI finds every exam, quiz, homework, project and reading with its date. You review and fix the results, see everything on one dashboard and calendar, and sync to **Google Calendar**.

This is the full implementation of `AI Syllabus Planner.docx`. The **About** page inside the app (`/about`) walks through the whole project: idea, features, AI, architecture, database, team roles, timeline, risks and the demo script.

```
syllabus-planner/
├── backend/            FastAPI + SQLAlchemy API (Python)
│   ├── app/
│   │   ├── main.py            app setup, CORS, /api/health
│   │   ├── models.py          users, courses, syllabi, events tables
│   │   ├── schemas.py         request/response shapes
│   │   ├── auth.py            password hashing + JWT
│   │   ├── routers/           auth, courses, syllabi, events, google, assistant
│   │   └── services/
│   │       ├── pdf.py         PDF → text (pypdf)
│   │       ├── llm.py         free AI providers: Gemini → Groq (→ optional Claude)
│   │       ├── extractor.py   text/PDF → structured events (AI, or rule-based fallback)
│   │       ├── assistant.py   "What do I have due next week?"
│   │       └── gcal.py        Google OAuth 2.0 + Calendar API
│   └── requirements.txt
├── frontend/           Next.js 14 + React + TypeScript + Tailwind
│   └── src/app/        /, /about, /login, /signup, /dashboard, /courses, /courses/[id],
│                       /upload, /review/[id], /events, /calendar, /assistant, /settings
└── sample/CS3345_syllabus.pdf   demo syllabus
```

## Quick start (Windows)

You need **Python 3.10+** and **Node.js 18+**.

```powershell
# 1. Backend  (terminal 1)
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env          # then edit .env (see below)
.venv\Scripts\uvicorn app.main:app --reload --port 8000

# 2. Frontend (terminal 2)
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Open http://localhost:3000. Interactive API docs are at http://localhost:8000/docs.

On macOS/Linux, use `.venv/bin/...` and `cp` instead.

Or run `start.ps1` from the project root to open both servers in separate windows.

## Configuration (`backend/.env`)

| Variable | What it does |
|---|---|
| `SECRET_KEY` | Signs login tokens. Use a long random string (32+ characters). |
| `DATABASE_URL` | Defaults to SQLite (`syllabus.db`). For PostgreSQL/Supabase use `postgresql+psycopg://user:pass@host:5432/db` and `pip install "psycopg[binary]"`. |
| `GEMINI_API_KEY` | **Free.** Turns on AI extraction and the AI assistant. Get it at https://aistudio.google.com → "Get API key" (no credit card). |
| `GROQ_API_KEY` | **Free, optional backup.** Used if Gemini fails or hits its daily limit. Get it at https://console.groq.com/keys. Text only, so it can't read scanned PDFs. |
| `GEMINI_MODEL` / `GROQ_MODEL` | Default to `gemini-flash-latest` / `llama-3.3-70b-versatile`. |
| `ANTHROPIC_API_KEY` | Optional, paid. Not needed. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Turn on the Google Calendar integration. |
| `GOOGLE_REDIRECT_URI` | Must exactly match the URI registered with Google. Default: `http://localhost:8000/api/google/callback`. |
| `FRONTEND_URL` | Where to send the user after Google sign-in. Default: `http://localhost:3000`. |
| `DEFAULT_TIMEZONE` | Timezone for timed events sent to Google. Default: `America/Chicago`. |

## Google Calendar setup

1. Go to https://console.cloud.google.com, create a project, then go to **APIs & Services → Library** and enable the **Google Calendar API**.
2. Under **OAuth consent screen**, choose **External**, fill in the app name, and add your team's Google accounts as **Test users**.
3. Under **Credentials → Create credentials → OAuth client ID**, choose **Web application** and add the authorized redirect URI `http://localhost:8000/api/google/callback`.
4. Copy the client ID and secret into `backend/.env` and restart the backend.
5. In the app, open **Google Calendar** in the sidebar, click **Connect Google Calendar**, then **Sync**.

The app asks only for the `calendar.events` scope. It syncs only deadlines the student has **confirmed**. Edits and deletions update Google automatically.

## How it works

1. **Upload**: `POST /api/syllabi` saves the PDF and starts a background job. The frontend polls until it finishes.
2. **Read**: `services/pdf.py` pulls the selectable text out of the PDF with pypdf.
3. **Extract**: `services/extractor.py` asks the AI (via `services/llm.py`) for JSON matching a schema. For each item it returns title, type, ISO date, time, material covered, grade weight, the exact source line, and a 0–1 confidence score. The free **Gemini** API gets the PDF itself, so scanned PDFs work too. If Gemini fails, **Groq** gets the extracted text. With no keys, or if both fail, a regex/keyword parser runs instead.
4. **Review**: events are saved with `confirmed = false`. The review page highlights low-confidence items and shows the source line, and lets the student edit, delete or add items before confirming.
5. **Use**: confirmed events appear on the dashboard (with a weekly workload chart), the deadlines list, the calendar, and in the assistant.
6. **Sync**: `services/gcal.py` runs the OAuth flow and creates or updates Google Calendar events.

## Main API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup`, `/api/auth/login` | Create account / log in, returns a token |
| GET/POST/PUT/DELETE | `/api/courses[/{id}]` | Manage courses |
| POST | `/api/syllabi` | Upload a syllabus (multipart: `course_id`, `file`) |
| GET | `/api/syllabi/{id}` | Status, extracted text and events |
| POST | `/api/syllabi/{id}/confirm` · `/reprocess` | Approve results · run extraction again |
| GET/POST/PATCH/DELETE | `/api/events[/{id}]` | List (filters: start, end, course_id, type, confirmed, completed), create, edit, delete |
| GET | `/api/events/stats` | Dashboard numbers + workload by week |
| POST | `/api/assistant/ask` | Ask a question about your deadlines |
| GET | `/api/google/status` · `/auth-url` · `/callback` | Google OAuth |
| POST | `/api/google/sync` · `/disconnect` | Push events to Google / disconnect |

## Demo script

1. Sign up / log in. 2. Create course **CS 3345**. 3. Upload `sample/CS3345_syllabus.pdf`. 4. Watch it process. 5. Review the extracted items. 6. Change one date. 7. Confirm, then open the **Calendar**. 8. Connect and sync Google Calendar. 9. Ask the assistant *"What do I have due next week?"*

## Hosting it for free

| Part | Service (free plan) | Notes |
|---|---|---|
| Database | **Neon** (neon.tech) | Free Postgres; sleeps when idle and wakes automatically |
| Backend | **Render** (render.com) | Free web service; sleeps after 15 min idle, ~1 min to wake |
| Website | **Vercel** (vercel.com) | Free for hobby projects, made for Next.js |

### 1. Database (Neon)
1. Sign up at https://neon.tech with GitHub and create a project.
2. Copy the **connection string** (`postgresql://...neon.tech/neondb?sslmode=require`). The app creates its tables on first start.

### 2. Backend (Render)
1. Sign up at https://render.com with GitHub.
2. Choose **New → Blueprint** and pick this repo. Render reads `render.yaml`.
3. Fill in the values it asks for:
   - `DATABASE_URL`: the Neon connection string
   - `GEMINI_API_KEY` (and optionally `GROQ_API_KEY`)
   - `FRONTEND_URL`: put `http://localhost:3000` for now and update it after step 3
   - Google values: leave blank for now (see step 4)
4. Deploy, then copy the backend URL, e.g. `https://ai-syllabus-planner-api.onrender.com`. Check `https://.../api/health`.

### 3. Website (Vercel)
1. Sign up at https://vercel.com with GitHub, then **Add New → Project** and import this repo.
2. Set **Root Directory** to `frontend`.
3. Add the environment variable `NEXT_PUBLIC_API_URL` = your Render backend URL (no trailing slash).
4. Deploy and copy the site URL, e.g. `https://ai-syllabus-planner.vercel.app`.
5. In Render, set `FRONTEND_URL` to that Vercel URL (this allows the site through CORS) and save. Render redeploys.

### 4. Google Calendar in production
In Google Cloud Console → Credentials → your OAuth client, add the authorized redirect URI
`https://<your-render-app>.onrender.com/api/google/callback`. Then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
`GOOGLE_REDIRECT_URI` (that same URL) in Render. While the OAuth app is in "Testing" mode, only Google accounts listed as
**test users** can connect.

### Free-tier caveats
- **First load after idle is slow:** the free Render backend sleeps after 15 minutes. The first request then takes about a minute.
  Open the site a minute before a demo.
- **Uploaded PDFs are temporary:** Render's free disk is wiped on restart. Extracted deadlines are safe in Neon, but
  "Re-run extraction" won't work on old uploads.
- Pushing to `main` redeploys both Vercel and Render automatically.

## Notes

- Free-tier AI limits are small (Gemini Flash may allow only a few dozen requests a day). Each syllabus upload uses 1 request and each assistant question uses 1. If you hit the limit, the app falls back automatically.
- `sqlalchemy` is pinned below 2.1 because 2.1 requires compiled extensions that some Windows security policies (Smart App Control) block.
- Not built yet: Canvas integration (a "later" feature in the plan).
