import json
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from sqlalchemy.orm import Session

from models import Run
import gemini_client
from normalize import normalize_extraction


STEPS = [
    "Cleanup & Normalization",
    "Structured Extraction",
    "Escalation Check",
    "Output Generation",
]


def word_count(text: str) -> int:
    return len(text.split())


def needs_escalation(extraction: dict) -> bool:
    flags = extraction.get("escalation_flags", [])
    if flags:
        return True
    for item in extraction.get("action_items", []):
        if item.get("confidence") == "low":
            return True
    return False


def build_output_context(run: Run, resolutions: Optional[list] = None) -> str:
    parts = [f"Cleaned transcript:\n{run.cleaned_transcript}"]
    extraction = run.get_extraction()
    if extraction:
        parts.append(f"Extraction:\n{json.dumps(extraction, indent=2)}")
    if resolutions:
        parts.append(f"Human resolutions:\n{json.dumps(resolutions, indent=2)}")
    elif run.human_resolutions:
        parts.append(f"Human resolutions:\n{run.human_resolutions}")
    return "\n\n".join(parts)


async def run_pipeline(
    db: Session,
    run_id: str,
    start_from_step: int = 1,
    api_key: Optional[str] = None,
) -> AsyncGenerator[dict, None]:
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        yield {"type": "error", "message": "Run not found"}
        return

    try:
        if start_from_step <= 1:
            run.status = "processing"
            run.current_step = 1
            db.commit()
            yield {"type": "step_start", "step": 1, "label": STEPS[0]}
            try:
                cleaned = await gemini_client.step1_cleanup(run.transcript_raw, api_key=api_key)
                run.cleaned_transcript = cleaned
                run.current_step = 1
                db.commit()
                yield {"type": "step_complete", "step": 1, "label": STEPS[0], "preview": cleaned[:200]}
            except gemini_client.RateLimitError as e:
                run.status = "failed"
                run.failed_step = 1
                run.error_message = str(e)
                db.commit()
                yield {"type": "rate_limit", "step": 1, "message": str(e)}
                return
            except gemini_client.GeminiAPIError as e:
                run.status = "failed"
                run.failed_step = 1
                run.error_message = str(e)
                db.commit()
                yield {"type": "error", "step": 1, "message": str(e)}
                return
            except TimeoutError as e:
                run.status = "failed"
                run.failed_step = 1
                run.error_message = str(e)
                db.commit()
                yield {"type": "timeout", "step": 1, "message": str(e)}
                return

        if start_from_step <= 2:
            run.current_step = 2
            db.commit()
            yield {"type": "step_start", "step": 2, "label": STEPS[1]}
            extraction = None
            raw_fallback = None
            try:
                extraction = await gemini_client.step2_extract(run.cleaned_transcript, api_key=api_key)
            except (json.JSONDecodeError, ValueError):
                try:
                    raw = await gemini_client.step2_extract(run.cleaned_transcript, retry=True, api_key=api_key)
                    extraction = raw
                except Exception as e:
                    run.status = "failed"
                    run.failed_step = 2
                    run.error_message = f"Malformed JSON from model: {e}"
                    db.commit()
                    yield {
                        "type": "json_error",
                        "step": 2,
                        "message": "Could not parse extraction. Raw response saved.",
                        "raw": raw_fallback,
                    }
                    return
            except gemini_client.RateLimitError as e:
                run.status = "failed"
                run.failed_step = 2
                run.error_message = str(e)
                db.commit()
                yield {"type": "rate_limit", "step": 2, "message": str(e)}
                return
            except gemini_client.GeminiAPIError as e:
                run.status = "failed"
                run.failed_step = 2
                run.error_message = str(e)
                db.commit()
                yield {"type": "error", "step": 2, "message": str(e)}
                return
            except TimeoutError as e:
                run.status = "failed"
                run.failed_step = 2
                run.error_message = str(e)
                db.commit()
                yield {"type": "timeout", "step": 2, "message": str(e)}
                return

            extraction = normalize_extraction(extraction)
            run.set_extraction(extraction)
            if not run.title and extraction.get("meeting_summary"):
                run.title = extraction["meeting_summary"][:80]
            db.commit()
            yield {
                "type": "step_complete",
                "step": 2,
                "label": STEPS[1],
                "extraction": extraction,
            }

        extraction = run.get_extraction()

        if start_from_step <= 3:
            run.current_step = 3
            db.commit()
            yield {"type": "step_start", "step": 3, "label": STEPS[2]}

            if needs_escalation(extraction):
                run.status = "needs_review"
                try:
                    questions = await gemini_client.step3_clarifying(extraction, api_key=api_key)
                    run.set_clarifying(questions)
                except Exception as e:
                    questions = _fallback_clarifying(extraction)
                    run.set_clarifying(questions)
                    run.error_message = f"Clarifying step partial: {e}"
                db.commit()
                yield {
                    "type": "needs_review",
                    "step": 3,
                    "label": STEPS[2],
                    "clarifying_questions": run.get_clarifying(),
                    "extraction": extraction,
                }
                return
            else:
                yield {"type": "step_complete", "step": 3, "label": STEPS[2], "skipped": True}

        if start_from_step <= 4:
            async for event in _run_step4(db, run, api_key=api_key):
                yield event

    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        db.commit()
        yield {"type": "error", "message": str(e)}


def _fallback_clarifying(extraction: dict) -> list:
    questions = []
    for i, item in enumerate(extraction.get("action_items", [])):
        if item.get("confidence") == "low":
            questions.append({
                "item_index": i,
                "item_type": "action_item",
                "question": f"Who owns '{item.get('task')}' and what is the deadline?",
                "excerpt": item.get("source_quote", ""),
                "reason": "Low confidence owner or deadline",
            })
    for i, flag in enumerate(extraction.get("escalation_flags", [])):
        questions.append({
            "item_index": i,
            "item_type": "escalation",
            "question": f"Please clarify: {flag.get('reason')}",
            "excerpt": flag.get("excerpt", ""),
            "reason": flag.get("reason", "Escalation flag"),
        })
    return questions


async def _run_step4(db: Session, run: Run, api_key: Optional[str] = None) -> AsyncGenerator[dict, None]:
    run.current_step = 4
    run.status = "processing"
    db.commit()
    yield {"type": "step_start", "step": 4, "label": STEPS[3]}

    context = build_output_context(run)
    try:
        slack = await gemini_client.step4_slack(context, api_key=api_key)
        email = await gemini_client.step4_email(context, api_key=api_key)
        run.slack_output = slack
        run.email_output = email
        run.status = "completed"
        db.commit()
        yield {
            "type": "step_complete",
            "step": 4,
            "label": STEPS[3],
            "slack_output": slack,
            "email_output": email,
            "extraction": run.get_extraction(),
        }
        yield {"type": "complete", "run_id": run.id}
    except gemini_client.RateLimitError as e:
        run.status = "failed"
        run.failed_step = 4
        run.error_message = str(e)
        db.commit()
        yield {"type": "rate_limit", "step": 4, "message": str(e)}
    except gemini_client.GeminiAPIError as e:
        run.status = "failed"
        run.failed_step = 4
        run.error_message = str(e)
        db.commit()
        yield {"type": "error", "step": 4, "message": str(e)}
    except TimeoutError as e:
        run.status = "failed"
        run.failed_step = 4
        run.error_message = str(e)
        db.commit()
        yield {"type": "timeout", "step": 4, "message": str(e)}


async def run_step4_only(db: Session, run_id: str, api_key: Optional[str] = None) -> AsyncGenerator[dict, None]:
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        yield {"type": "error", "message": "Run not found"}
        return
    async for event in _run_step4(db, run, api_key=api_key):
        yield event


def create_run(db: Session, transcript: str) -> Run:
    run = Run(
        id=str(uuid.uuid4()),
        transcript_raw=transcript,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
