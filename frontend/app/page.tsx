"use client";

import { useCallback, useEffect, useState } from "react";
import TranscriptInput from "@/components/TranscriptInput";
import ProcessingStepper from "@/components/ProcessingStepper";
import EscalationPanel from "@/components/EscalationPanel";
import OutputTabs from "@/components/OutputTabs";
import RunHistory from "@/components/RunHistory";
import {
  startProcess,
  uploadFile,
  listRuns,
  getRun,
  subscribeToStream,
  retryStep,
  type RunSummary,
  type Extraction,
  type ClarifyingQuestion,
  type RunDetail,
} from "@/lib/api";
import { PIPELINE_STEPS, type StepState } from "@/lib/types";

function initSteps(): StepState[] {
  return PIPELINE_STEPS.map((label, i) => ({
    step: i + 1,
    label,
    status: "pending" as const,
  }));
}

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState[]>(initSteps);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [clarifying, setClarifying] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [needsReview, setNeedsReview] = useState(false);
  const [slackOutput, setSlackOutput] = useState<string | null>(null);
  const [emailOutput, setEmailOutput] = useState<string | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      const data = await listRuns();
      setHistory(data.runs);
    } catch {
      /* backend may be offline */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const t = setInterval(() => {
      setRateLimitCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [rateLimitCountdown]);

  const updateStep = (step: number, status: StepState["status"]) => {
    setSteps((prev) =>
      prev.map((s) => (s.step === step ? { ...s, status } : s))
    );
  };

  const handleStreamEvent = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string;

      if (type === "step_start") {
        updateStep(data.step as number, "active");
      } else if (type === "step_complete") {
        updateStep(data.step as number, data.skipped ? "skipped" : "complete");
        if (data.extraction) setExtraction(data.extraction as Extraction);
        if (data.slack_output) setSlackOutput(data.slack_output as string);
        if (data.email_output) setEmailOutput(data.email_output as string);
      } else if (type === "needs_review") {
        updateStep(3, "complete");
        setNeedsReview(true);
        setClarifying((data.clarifying_questions as ClarifyingQuestion[]) || []);
        if (data.extraction) setExtraction(data.extraction as Extraction);
        setLoading(false);
        loadHistory();
      } else if (type === "complete") {
        setLoading(false);
        loadHistory();
      } else if (type === "rate_limit") {
        const msg = (data.message as string) || "API quota exceeded. Wait a minute and retry.";
        setRateLimitCountdown(60);
        setError(msg);
        updateStep(data.step as number, "error");
        setFailedStep(data.step as number);
        setLoading(false);
      } else if (type === "timeout" || type === "error" || type === "json_error") {
        setError((data.message as string) || "An error occurred");
        if (data.step) {
          updateStep(data.step as number, "error");
          setFailedStep(data.step as number);
        }
        setLoading(false);
      }
    },
    [loadHistory]
  );

  const startStreaming = (id: string) => {
    setRunId(id);
    setSteps(initSteps());
    setError(null);
    setFailedStep(null);
    setExtraction(null);
    setClarifying([]);
    setAnswers({});
    setNeedsReview(false);
    setSlackOutput(null);
    setEmailOutput(null);
    setLoading(true);

    subscribeToStream(id, handleStreamEvent, (err) => {
      setError(err.message);
      setLoading(false);
    });
  };

  const handleProcess = async () => {
    try {
      const { run_id, warning: w } = await startProcess(transcript);
      if (w) setWarning(w);
      startStreaming(run_id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const { run_id, warning: w, transcript: text } = await uploadFile(file);
      setTranscript(text);
      if (w) setWarning(w);
      startStreaming(run_id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleResolve = () => {
    if (!runId) return;
    setLoading(true);
    setNeedsReview(false);
    updateStep(4, "active");

    const resolutions = clarifying.map((_, i) => ({
      question_index: i,
      answer: answers[i] || "",
    }));

    subscribeToStream(
      runId,
      handleStreamEvent,
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      "resolve",
      { resolutions }
    );
  };

  const handleRetry = async (step: number) => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      await retryStep(runId, step, handleStreamEvent);
      setLoading(false);
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  const loadRun = async (id: string) => {
    try {
      const run: RunDetail = await getRun(id);
      setRunId(run.id);
      setTranscript(run.transcript_raw);
      setExtraction(run.extraction);
      setClarifying(run.clarifying_questions || []);
      setSlackOutput(run.slack_output);
      setEmailOutput(run.email_output);
      setNeedsReview(run.status === "needs_review");
      setError(run.error_message);

      const completed = run.status === "completed" ? 4 : run.current_step;
      setSteps(
        PIPELINE_STEPS.map((label, i) => ({
          step: i + 1,
          label,
          status:
            i + 1 < completed
              ? "complete"
              : i + 1 === completed && run.status === "processing"
                ? "active"
                : run.failed_step === i + 1
                  ? "error"
                  : "pending",
        }))
      );
      setFailedStep(run.failed_step);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white no-print">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">ActionFlow</h1>
          <p className="text-sm text-gray-600 mt-1">
            Turn meeting transcripts into action items, decisions, and ready-to-send updates
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <RunHistory
            runs={history}
            activeId={runId}
            onSelect={loadRun}
            loading={historyLoading}
          />

          <div className="flex-1 min-w-0 space-y-8">
            {!runId || needsReview || !extraction ? (
              <section className="bg-white border border-gray-200 rounded-lg p-6 no-print">
                <TranscriptInput
                  value={transcript}
                  onChange={setTranscript}
                  onProcess={handleProcess}
                  onFileUpload={handleFileUpload}
                  loading={loading}
                  warning={warning}
                />
              </section>
            ) : null}

            {rateLimitCountdown > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 no-print">
                Rate limited — retry available in {rateLimitCountdown}s
              </div>
            )}

            {error && !runId && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 no-print">
                <strong>Error:</strong> {error}
              </div>
            )}

            {(loading || runId) && (
              <section className="bg-white border border-gray-200 rounded-lg p-6 no-print">
                <ProcessingStepper
                  steps={steps}
                  error={error}
                  failedStep={failedStep}
                  onRetry={rateLimitCountdown > 0 ? undefined : handleRetry}
                />
              </section>
            )}

            {needsReview && clarifying.length > 0 && (
              <EscalationPanel
                questions={clarifying}
                answers={answers}
                onAnswerChange={(i, v) => setAnswers((a) => ({ ...a, [i]: v }))}
                onResolve={handleResolve}
                loading={loading}
              />
            )}

            {extraction && !needsReview && (
              <section className="no-print">
                <OutputTabs
                  extraction={extraction}
                  slackOutput={slackOutput}
                  emailOutput={emailOutput}
                />
              </section>
            )}

            {extraction && (
              <section className="hidden print-only">
                <h1>ActionFlow Report</h1>
                <p>{extraction.meeting_summary}</p>
                <h2>Action Items</h2>
                <ul>
                  {extraction.action_items.map((a, i) => (
                    <li key={i}>
                      {a.task} — {a.owner} — {a.deadline}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
