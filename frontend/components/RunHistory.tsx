"use client";

import type { RunSummary } from "@/lib/api";

interface Props {
  runs: RunSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  completed: "text-green-700",
  needs_review: "text-amber-700",
  processing: "text-blue-700",
  failed: "text-red-700",
  pending: "text-gray-500",
};

export default function RunHistory({ runs, activeId, onSelect, loading }: Props) {
  return (
    <aside className="w-full lg:w-64 shrink-0 no-print">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        History
      </h3>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && runs.length === 0 && (
        <p className="text-sm text-gray-500">No past runs yet.</p>
      )}
      <ul className="space-y-1 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {runs.map((run) => (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => onSelect(run.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeId === run.id
                  ? "bg-gray-900 text-white"
                  : "hover:bg-gray-200 text-gray-800"
              }`}
            >
              <p className="font-medium truncate">{run.title || "Untitled meeting"}</p>
              <p
                className={`text-xs mt-0.5 truncate ${
                  activeId === run.id ? "text-gray-300" : statusColors[run.status] || "text-gray-500"
                }`}
              >
                {run.status.replace("_", " ")} ·{" "}
                {new Date(run.created_at).toLocaleDateString()}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
