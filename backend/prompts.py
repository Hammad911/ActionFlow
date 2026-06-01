"""All Gemini prompts for the ActionFlow pipeline."""

SYSTEM_ANALYST = (
    "You are a precise meeting analyst. "
    "Output only valid JSON when asked for structured data. "
    "Never add commentary outside the JSON."
)

STEP1_CLEANUP = """Clean up this transcript. Remove filler words, fix obvious typos, normalize speaker labels. Output cleaned text only.

Transcript:
{transcript}"""

STEP2_EXTRACTION = """Extract structured data from this meeting transcript as a JSON object with exactly these keys:
- decisions: list of objects (NOT strings). Each object MUST have: "decision", "made_by", "timestamp_approx"
- action_items: list of objects. Each MUST have: "task", "owner", "deadline", "confidence" ("high"|"medium"|"low"), "source_quote"
- unresolved_questions: list of objects (NOT strings). Each MUST have: "question", "raised_by", "context"
- meeting_summary: string (2-3 sentences)
- escalation_flags: list of {{"reason": str, "excerpt": str}}

Rules:
- confidence is "low" when owner or deadline is inferred rather than explicitly stated
- Add escalation_flags when owner is ambiguous, deadline appears to be in the past, or task is unclear
- Output ONLY valid JSON, no markdown fences

Cleaned transcript:
{cleaned_transcript}"""

STEP3_CLARIFYING = """For each low-confidence action item or escalation flag below, write one clarifying question a human should ask to resolve the ambiguity.

Return JSON: {{"clarifying_questions": [{{"item_index": int, "item_type": "action_item"|"escalation", "question": str, "excerpt": str, "reason": str}}]}}

Data:
{extraction_json}"""

STEP4_SLACK = """Generate a Slack message (plain text) for this meeting's action items.
- Use emoji bullets
- Group by owner
- Be concise and scannable
- Output plain text only, no JSON

Meeting data:
{context}"""

STEP4_EMAIL = """Generate a professional HTML email body for this meeting's action items.
- Group by owner with deadline callouts
- Use simple HTML (p, ul, li, strong tags only)
- Professional tone
- Output HTML only, no JSON or markdown

Meeting data:
{context}"""

STEP2_RETRY = """Your previous response was not valid JSON. Return ONLY a valid JSON object with these keys:
decisions, action_items, unresolved_questions, meeting_summary, escalation_flags

Use the same schema as before. No markdown, no commentary.

Cleaned transcript:
{cleaned_transcript}"""
