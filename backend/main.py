import os
import json
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load backend/.env before any module reads os.environ
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from docx import Document

from database import engine, get_db, Base
from models import Run
from pipeline import create_run, run_pipeline, run_step4_only, word_count

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ActionFlow API", version="1.0.0")

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    transcript: str


class ResolveRequest(BaseModel):
    resolutions: list[dict]


class RunSummary(BaseModel):
    id: str
    title: Optional[str]
    status: str
    created_at: str
    current_step: int


@app.get("/api/health")
def health():
    key_set = bool(os.getenv("GOOGLE_API_KEY", "").strip())
    return {"status": "ok", "google_api_key_configured": key_set}


@app.post("/api/process")
def start_process(req: ProcessRequest, db: Session = Depends(get_db)):
    if not req.transcript.strip():
        raise HTTPException(400, "Transcript cannot be empty")
    if len(req.transcript) > 50000:
        raise HTTPException(400, "Transcript exceeds 50,000 character limit")
    run = create_run(db, req.transcript)
    warning = None
    if word_count(req.transcript) < 100:
        warning = "This transcript may be too short for reliable extraction"
    return {"run_id": run.id, "warning": warning}


@app.post("/api/upload")
async def upload_transcript(file: UploadFile = File(...), db: Session = Depends(get_db)):
    name = file.filename or ""
    content = await file.read()
    text = ""

    if name.endswith(".txt") or name.endswith(".vtt"):
        text = content.decode("utf-8", errors="replace")
    elif name.endswith(".docx"):
        import io
        doc = Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs)
    else:
        raise HTTPException(400, "Supported formats: .txt, .docx, .vtt")

    if len(text) > 50000:
        raise HTTPException(400, "File exceeds 50,000 character limit")

    run = create_run(db, text)
    warning = None
    if word_count(text) < 100:
        warning = "This transcript may be too short for reliable extraction"
    return {"run_id": run.id, "warning": warning, "transcript": text}


@app.get("/api/runs/{run_id}/stream")
async def stream_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")

    async def event_generator():
        async for event in run_pipeline(db, run_id, start_from_step=1):
            yield {"event": event.get("type", "message"), "data": json.dumps(event)}

    return EventSourceResponse(event_generator())


@app.post("/api/runs/{run_id}/resolve")
async def resolve_run(run_id: str, req: ResolveRequest, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status != "needs_review":
        raise HTTPException(400, "Run is not awaiting review")

    run.set_resolutions(req.resolutions)
    run.status = "processing"
    db.commit()

    async def event_generator():
        async for event in run_step4_only(db, run_id):
            yield {"event": event.get("type", "message"), "data": json.dumps(event)}

    return EventSourceResponse(event_generator())


@app.get("/api/runs")
def list_runs(page: int = 1, per_page: int = 20, db: Session = Depends(get_db)):
    offset = (page - 1) * per_page
    total = db.query(Run).count()
    runs = (
        db.query(Run)
        .order_by(Run.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "runs": [
            {
                "id": r.id,
                "title": r.title or "Untitled meeting",
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "current_step": r.current_step,
            }
            for r in runs
        ],
    }


@app.get("/api/runs/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    return {
        "id": run.id,
        "title": run.title,
        "status": run.status,
        "current_step": run.current_step,
        "failed_step": run.failed_step,
        "error_message": run.error_message,
        "transcript_raw": run.transcript_raw,
        "cleaned_transcript": run.cleaned_transcript,
        "extraction": run.get_extraction(),
        "clarifying_questions": run.get_clarifying(),
        "human_resolutions": run.get_resolutions(),
        "slack_output": run.slack_output,
        "email_output": run.email_output,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
    }


@app.post("/api/runs/{run_id}/retry")
async def retry_step(run_id: str, step: int = 1, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")

    async def event_generator():
        async for event in run_pipeline(db, run_id, start_from_step=step):
            yield {"event": event.get("type", "message"), "data": json.dumps(event)}

    return EventSourceResponse(event_generator())
