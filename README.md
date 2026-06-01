# ActionFlow

Meeting-to-action pipeline: paste a raw meeting transcript and ActionFlow extracts structured action items, decisions, owners, deadlines, and unresolved questions — then formats output for Slack and email.

**AI model:** Google Gemini (`gemini-2.5-flash` by default) via `google-generativeai`.

## Prerequisites

- Node.js 18+
- Python 3.11+
- [Google AI API key](https://aistudio.google.com/apikey)

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GOOGLE_API_KEY=your_key
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Ensure NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google Generative AI API key from [AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Model id (default: `gemini-2.5-flash`). Use this if `gemini-2.0-flash` shows quota errors. |
| `DATABASE_URL` | SQLAlchemy URL (default: `sqlite:///./actionflow.db`) |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `NEXT_PUBLIC_API_URL` | Backend URL for the Next.js app |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/process` | Start a new run |
| `GET` | `/api/runs/{id}/stream` | SSE pipeline progress |
| `POST` | `/api/runs/{id}/resolve` | Submit human answers, run step 4 |
| `GET` | `/api/runs` | List past runs (paginated) |
| `GET` | `/api/runs/{id}` | Full run result |
| `POST` | `/api/runs/{id}/retry?step=N` | Retry from step N |

## Pipeline Steps

1. **Cleanup & Normalization** — remove filler, fix typos, normalize speakers
2. **Structured Extraction** — JSON with decisions, action items, questions, summary, escalation flags
3. **Escalation Check** — if low-confidence items or flags exist, generate clarifying questions (human-in-the-loop)
4. **Output Generation** — Slack plain-text + HTML email (skipped until escalation resolved)

Prompts live in `backend/prompts.py` for easy iteration.

## Sample Transcript

Click **Load sample** in the UI, or paste this:

```
Product Sync — March 15, 2026

Sarah Chen (PM): Alright everyone, let's get started. We need to finalize the Q2 roadmap today.

James Wu (Eng Lead): Yeah so um, the API migration is basically done. We hit 98% of endpoints. The remaining two are the billing webhooks — those are trickier.

Sarah: OK great. Decision: we're launching the new API on April 1st regardless of those two webhooks. James, can your team handle a parallel run for billing?

James: Sure, we can do that. I'll have Priya own the webhook migration — she knows that codebase best. Target is March 28th for those.

Maria Santos (Design): On the design side, I finished the dashboard mockups. Sarah, you wanted feedback by Friday right?

Sarah: Actually let's push that to next Monday — March 22nd. I won't have time to review before Friday.

Tom Bradley (Sales): Quick question — are we still planning the customer beta for the analytics feature? My team has three enterprise prospects asking about it.

Sarah: Good question. We haven't decided yet. Tom, can you send me the prospect names and their use cases? I'll loop back after we talk to eng about capacity.

James: Oh also — someone needs to update the status page documentation before launch. Not sure who owns that.

Sarah: I'll take that doc update myself. Due March 30th.

Maria: One more thing — should we use the new component library for the beta dashboard or stick with legacy?

Sarah: Let's table that for next week's design review.
```

## Project Structure

```
Bamboo/
├── backend/
│   ├── main.py           # FastAPI app & routes
│   ├── prompts.py        # All Gemini prompts
│   ├── gemini_client.py  # Google Generative AI SDK wrapper
│   ├── pipeline.py       # Sequential agent steps + SSE events
│   ├── models.py         # SQLAlchemy Run model
│   └── database.py
└── frontend/
    ├── app/page.tsx      # Main UI
    └── components/       # Transcript, stepper, escalation, output tabs, history
```

## Production Notes

- Set `DATABASE_URL` to PostgreSQL for production
- Deploy backend (Railway, Fly.io, etc.) and set `NEXT_PUBLIC_API_URL` to its public URL
- CORS: set `CORS_ORIGINS` to your frontend domain

### Railway

This is a monorepo — set **Root Directory** to `backend` or `frontend` per service. See **[DEPLOY.md](./DEPLOY.md)** for step-by-step Railway setup.
