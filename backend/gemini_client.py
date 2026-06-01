import json
import os
import re
import asyncio
from functools import partial

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

import prompts

# gemini-2.0-flash often has 0 free-tier quota; 2.5-flash works on current AI Studio keys
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
EXTRACTION_MAX_TOKENS = 4096
OUTPUT_MAX_TOKENS = 2048
STEP_TIMEOUT = 60


def _configure():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)


def _build_model(temperature: float, max_tokens: int):
    _configure()
    return genai.GenerativeModel(
        MODEL_NAME,
        system_instruction=prompts.SYSTEM_ANALYST,
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )


def _friendly_api_error(exc: Exception) -> str:
    """Turn Google API errors into actionable messages."""
    if isinstance(exc, google_exceptions.ResourceExhausted):
        msg = str(exc)
        if "limit: 0" in msg:
            return (
                f"Model '{MODEL_NAME}' has no quota on your API key. "
                f"Set GEMINI_MODEL=gemini-2.5-flash in backend/.env and restart the server."
            )
        if "quota" in msg.lower():
            return (
                "Google API daily/minute quota exceeded. Wait a few minutes or check "
                "https://ai.dev/rate-limit — then try again."
            )
        return "Too many requests to Google API. Wait a minute and retry."

    if isinstance(exc, google_exceptions.InvalidArgument):
        if "api key" in str(exc).lower():
            return "Invalid GOOGLE_API_KEY. Create one at https://aistudio.google.com/apikey (starts with AIza…)."
        return str(exc)

    if isinstance(exc, google_exceptions.NotFound) and "model" in str(exc).lower():
        return (
            f"Model '{MODEL_NAME}' not available. Set GEMINI_MODEL=gemini-2.5-flash in backend/.env."
        )

    return str(exc)


def _is_rate_limited(exc: Exception) -> bool:
    if isinstance(exc, google_exceptions.ResourceExhausted):
        return True
    if isinstance(exc, google_exceptions.TooManyRequests):
        return True
    return False


async def _generate_async(model, prompt: str) -> str:
    loop = asyncio.get_event_loop()
    try:
        response = await asyncio.wait_for(
            loop.run_in_executor(None, partial(model.generate_content, prompt)),
            timeout=STEP_TIMEOUT,
        )
        if not response.candidates:
            raise ValueError("Model returned no content (possibly blocked by safety filters).")
        return response.text.strip()
    except asyncio.TimeoutError:
        raise TimeoutError(f"Step timed out after {STEP_TIMEOUT}s")
    except (RateLimitError, GeminiAPIError):
        raise
    except Exception as e:
        if _is_rate_limited(e):
            raise RateLimitError(_friendly_api_error(e)) from e
        raise GeminiAPIError(_friendly_api_error(e)) from e


class RateLimitError(Exception):
    pass


class GeminiAPIError(Exception):
    pass


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def parse_json_response(text: str) -> dict:
    cleaned = _strip_json_fences(text)
    return json.loads(cleaned)


async def step1_cleanup(transcript: str) -> str:
    model = _build_model(temperature=0, max_tokens=EXTRACTION_MAX_TOKENS)
    prompt = prompts.STEP1_CLEANUP.format(transcript=transcript)
    return await _generate_async(model, prompt)


async def step2_extract(cleaned: str, retry: bool = False) -> dict:
    model = _build_model(temperature=0, max_tokens=EXTRACTION_MAX_TOKENS)
    template = prompts.STEP2_RETRY if retry else prompts.STEP2_EXTRACTION
    prompt = template.format(cleaned_transcript=cleaned)
    raw = await _generate_async(model, prompt)
    return parse_json_response(raw)


async def step3_clarifying(extraction: dict) -> list:
    model = _build_model(temperature=0, max_tokens=EXTRACTION_MAX_TOKENS)
    prompt = prompts.STEP3_CLARIFYING.format(
        extraction_json=json.dumps(extraction, indent=2)
    )
    raw = await _generate_async(model, prompt)
    data = parse_json_response(raw)
    return data.get("clarifying_questions", [])


async def step4_slack(context: str) -> str:
    model = _build_model(temperature=0.3, max_tokens=OUTPUT_MAX_TOKENS)
    prompt = prompts.STEP4_SLACK.format(context=context)
    return await _generate_async(model, prompt)


async def step4_email(context: str) -> str:
    model = _build_model(temperature=0.3, max_tokens=OUTPUT_MAX_TOKENS)
    prompt = prompts.STEP4_EMAIL.format(context=context)
    return await _generate_async(model, prompt)
