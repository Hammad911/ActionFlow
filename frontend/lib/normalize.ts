import type { Extraction } from "./api";

export interface NormalizedExtraction {
  decisions: { decision: string; made_by: string; timestamp_approx: string }[];
  action_items: {
    task: string;
    owner: string;
    deadline: string;
    confidence: "high" | "medium" | "low";
    source_quote: string;
  }[];
  unresolved_questions: { question: string; raised_by: string; context: string }[];
  meeting_summary: string;
  escalation_flags: Extraction["escalation_flags"];
}

/** Client-side fallback when stored runs predate backend normalization. */
export function normalizeExtraction(raw: Extraction | null): NormalizedExtraction | null {
  if (!raw) return null;

  const decisions = (raw.decisions ?? []).map((item) => {
    if (typeof item === "string") {
      return { decision: item, made_by: "Not specified", timestamp_approx: "—" };
    }
    const d = item as Record<string, string>;
    return {
      decision: d.decision || d.text || d.summary || "",
      made_by: d.made_by || d.by || d.speaker || "Not specified",
      timestamp_approx: d.timestamp_approx || d.timestamp || d.time || "—",
    };
  });

  const unresolved_questions = (raw.unresolved_questions ?? []).map((item) => {
    if (typeof item === "string") {
      return { question: item, raised_by: "Not specified", context: "" };
    }
    const q = item as Record<string, string>;
    return {
      question: q.question || q.text || "",
      raised_by: q.raised_by || q.by || q.speaker || "Not specified",
      context: q.context || q.notes || "",
    };
  });

  const action_items = (raw.action_items ?? []).map((item) => {
    const a = item as Record<string, string>;
    const conf = (a.confidence || "medium").toLowerCase();
    return {
      task: a.task || a.action || a.description || "",
      owner: a.owner || a.assignee || "Unassigned",
      deadline: a.deadline || a.due_date || a.due || "",
      confidence: (["high", "medium", "low"].includes(conf)
        ? conf
        : "medium") as "high" | "medium" | "low",
      source_quote: a.source_quote || a.quote || a.source || "",
    };
  });

  return {
    ...raw,
    decisions: decisions.filter((d) => d.decision),
    unresolved_questions: unresolved_questions.filter((q) => q.question),
    action_items: action_items.filter((a) => a.task),
  };
}
