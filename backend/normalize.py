"""Normalize Gemini extraction JSON to the schema the UI expects."""


def _str(val, default: str = "") -> str:
    if val is None:
        return default
    if isinstance(val, str):
        return val.strip()
    return str(val).strip()


def normalize_extraction(data: dict) -> dict:
    if not isinstance(data, dict):
        return {
            "decisions": [],
            "action_items": [],
            "unresolved_questions": [],
            "meeting_summary": "",
            "escalation_flags": [],
        }

    out = dict(data)

    decisions = []
    for item in data.get("decisions") or []:
        if isinstance(item, str):
            decisions.append(
                {"decision": item, "made_by": "Not specified", "timestamp_approx": "—"}
            )
        elif isinstance(item, dict):
            decisions.append(
                {
                    "decision": _str(
                        item.get("decision")
                        or item.get("text")
                        or item.get("summary")
                        or item.get("description")
                    ),
                    "made_by": _str(
                        item.get("made_by") or item.get("by") or item.get("speaker"),
                        "Not specified",
                    ),
                    "timestamp_approx": _str(
                        item.get("timestamp_approx")
                        or item.get("timestamp")
                        or item.get("time"),
                        "—",
                    ),
                }
            )
    out["decisions"] = [d for d in decisions if d["decision"]]

    questions = []
    for item in data.get("unresolved_questions") or []:
        if isinstance(item, str):
            questions.append(
                {"question": item, "raised_by": "Not specified", "context": ""}
            )
        elif isinstance(item, dict):
            questions.append(
                {
                    "question": _str(
                        item.get("question") or item.get("text") or item.get("query")
                    ),
                    "raised_by": _str(
                        item.get("raised_by") or item.get("by") or item.get("speaker"),
                        "Not specified",
                    ),
                    "context": _str(item.get("context") or item.get("notes")),
                }
            )
    out["unresolved_questions"] = [q for q in questions if q["question"]]

    flags = []
    for item in data.get("escalation_flags") or []:
        if isinstance(item, str):
            flags.append({"reason": item, "excerpt": ""})
        elif isinstance(item, dict):
            flags.append(
                {
                    "reason": _str(item.get("reason") or item.get("text")),
                    "excerpt": _str(item.get("excerpt") or item.get("quote")),
                }
            )
    out["escalation_flags"] = [f for f in flags if f["reason"]]

    actions = []
    for item in data.get("action_items") or []:
        if isinstance(item, str):
            actions.append(
                {
                    "task": item,
                    "owner": "Unassigned",
                    "deadline": "",
                    "confidence": "medium",
                    "source_quote": "",
                }
            )
        elif isinstance(item, dict):
            conf = _str(item.get("confidence"), "medium").lower()
            if conf not in ("high", "medium", "low"):
                conf = "medium"
            actions.append(
                {
                    "task": _str(
                        item.get("task") or item.get("action") or item.get("description")
                    ),
                    "owner": _str(
                        item.get("owner") or item.get("assignee"), "Unassigned"
                    ),
                    "deadline": _str(
                        item.get("deadline") or item.get("due_date") or item.get("due")
                    ),
                    "confidence": conf,
                    "source_quote": _str(
                        item.get("source_quote") or item.get("quote") or item.get("source")
                    ),
                }
            )
    out["action_items"] = [a for a in actions if a["task"]]

    if not isinstance(out.get("meeting_summary"), str):
        out["meeting_summary"] = _str(out.get("meeting_summary"))

    return out
