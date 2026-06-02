const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
console.log("[ActionFlow] API_URL =", API_URL);

// ── User API key (stored in memory only, never persisted to server) ──
let _userApiKey: string | null = null;

export function setUserApiKey(key: string | null) {
  _userApiKey = key && key.trim() ? key.trim() : null;
}

export function getUserApiKey(): string | null {
  return _userApiKey;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (_userApiKey) {
    headers["X-Api-Key"] = _userApiKey;
  }
  return headers;
}

// ── Types ──

export interface RunSummary {
  id: string;
  title: string;
  status: string;
  created_at: string;
  current_step: number;
}

export type DecisionItem =
  | string
  | { decision?: string; made_by?: string; timestamp_approx?: string; text?: string; [key: string]: unknown };

export type QuestionItem =
  | string
  | { question?: string; raised_by?: string; context?: string; text?: string; [key: string]: unknown };

export interface Extraction {
  decisions: DecisionItem[];
  action_items: {
    task?: string;
    owner?: string;
    deadline?: string;
    due_date?: string;
    confidence?: "high" | "medium" | "low";
    source_quote?: string;
    [key: string]: unknown;
  }[];
  unresolved_questions: QuestionItem[];
  meeting_summary: string;
  escalation_flags: ({ reason: string; excerpt: string } | string)[];
}

export interface ClarifyingQuestion {
  item_index: number;
  item_type: string;
  question: string;
  excerpt: string;
  reason: string;
}

export interface RunDetail {
  id: string;
  title: string | null;
  status: string;
  current_step: number;
  failed_step: number | null;
  error_message: string | null;
  transcript_raw: string;
  cleaned_transcript: string | null;
  extraction: Extraction | null;
  clarifying_questions: ClarifyingQuestion[];
  human_resolutions: { question_index: number; answer: string }[];
  slack_output: string | null;
  email_output: string | null;
  created_at: string;
}

// ── API functions ──

export async function startProcess(transcript: string): Promise<{ run_id: string; warning?: string }> {
  const res = await fetch(`${API_URL}/api/process`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start processing");
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<{ run_id: string; warning?: string; transcript: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function listRuns(page = 1): Promise<{ runs: RunSummary[]; total: number }> {
  const res = await fetch(`${API_URL}/api/runs?page=${page}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load runs");
  return res.json();
}

export async function getRun(runId: string): Promise<RunDetail> {
  const res = await fetch(`${API_URL}/api/runs/${runId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Run not found");
  return res.json();
}

export function subscribeToStream(
  runId: string,
  onEvent: (data: Record<string, unknown>) => void,
  onError?: (err: Error) => void,
  path: "stream" | "resolve" = "stream",
  body?: unknown
): () => void {
  const url =
    path === "stream"
      ? `${API_URL}/api/runs/${runId}/stream`
      : `${API_URL}/api/runs/${runId}/resolve`;

  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(url, {
        method: path === "resolve" ? "POST" : "GET",
        headers: authHeaders(path === "resolve" ? { "Content-Type": "application/json" } : {}),
        body: path === "resolve" ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream connection failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(data);
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError" && onError) {
        onError(e as Error);
      }
    }
  })();

  return () => controller.abort();
}

export async function retryStep(runId: string, step: number, onEvent: (data: Record<string, unknown>) => void) {
  const url = `${API_URL}/api/runs/${runId}/retry?step=${step}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok || !res.body) throw new Error("Retry failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          /* skip */
        }
      }
    }
  }
}

export const SAMPLE_TRANSCRIPT = `Product Sync — March 15, 2026

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

James: Cool. I think that's everything from eng.

Sarah: Thanks everyone. I'll send notes after this.`;
