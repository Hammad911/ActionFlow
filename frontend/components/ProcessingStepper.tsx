"use client";

import type { StepState } from "@/lib/types";

interface Props {
  steps: StepState[];
  error?: string | null;
  failedStep?: number | null;
  onRetry?: (step: number) => void;
}

export default function ProcessingStepper({ steps, error, failedStep, onRetry }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pipeline Progress</h3>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.step} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.status === "complete"
                  ? "bg-green-600 text-white"
                  : s.status === "active"
                    ? "bg-gray-900 text-white animate-pulse"
                    : s.status === "error"
                      ? "bg-red-600 text-white"
                      : s.status === "skipped"
                        ? "bg-gray-300 text-gray-600"
                        : "bg-gray-200 text-gray-500"
              }`}
            >
              {s.status === "complete" ? "✓" : s.step}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  s.status === "active" ? "text-gray-900" : "text-gray-600"
                }`}
              >
                {s.label}
              </p>
              {s.status === "active" && (
                <p className="text-xs text-gray-500 mt-0.5">Running…</p>
              )}
              {s.status === "error" && failedStep === s.step && onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(s.step)}
                  className="text-xs text-red-600 underline mt-1"
                >
                  Retry this step
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
