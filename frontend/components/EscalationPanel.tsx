"use client";

import type { ClarifyingQuestion } from "@/lib/api";

interface Props {
  questions: ClarifyingQuestion[];
  answers: Record<number, string>;
  onAnswerChange: (index: number, value: string) => void;
  onResolve: () => void;
  loading: boolean;
}

export default function EscalationPanel({
  questions,
  answers,
  onAnswerChange,
  onResolve,
  loading,
}: Props) {
  const allAnswered = questions.every((_, i) => (answers[i] || "").trim().length > 0);

  return (
    <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-amber-900">Needs Your Input</h3>
        <p className="text-sm text-amber-800 mt-1">
          Some items need clarification before we can generate Slack and email drafts.
        </p>
      </div>

      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={i} className="bg-white border border-amber-200 rounded-md p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 font-bold text-sm">#{i + 1}</span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-gray-900">{q.question}</p>
                {q.reason && (
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Why:</span> {q.reason}
                  </p>
                )}
                {q.excerpt && (
                  <blockquote className="text-xs text-gray-600 border-l-2 border-gray-300 pl-3 italic">
                    &ldquo;{q.excerpt}&rdquo;
                  </blockquote>
                )}
              </div>
            </div>
            <input
              type="text"
              value={answers[i] || ""}
              onChange={(e) => onAnswerChange(i, e.target.value)}
              placeholder="Your answer…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onResolve}
        disabled={loading || !allAnswered}
        className="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-amber-700 transition-colors"
      >
        {loading ? "Generating outputs…" : "Resolve & Continue"}
      </button>
    </div>
  );
}
