"use client";

import { useState } from "react";
import type { Extraction } from "@/lib/api";
import { normalizeExtraction, type NormalizedExtraction } from "@/lib/normalize";

type Tab = "summary" | "actions" | "decisions" | "questions" | "slack" | "email";

interface Props {
  extraction: Extraction | null;
  slackOutput: string | null;
  emailOutput: string | null;
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[level] || "bg-gray-100 text-gray-800"}`}
    >
      {level}
    </span>
  );
}

export default function OutputTabs({ extraction, slackOutput, emailOutput }: Props) {
  const [tab, setTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState<string | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "actions", label: "Action Items" },
    { id: "decisions", label: "Decisions" },
    { id: "questions", label: "Open Questions" },
    { id: "slack", label: "Slack Draft" },
    { id: "email", label: "Email Draft" },
  ];

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePrint = () => window.print();

  if (!extraction) return null;

  const data = normalizeExtraction(extraction)!;

  return (
    <div className="space-y-4 print-area">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                tab === t.id
                  ? "bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Export as PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 min-h-[200px]">
        {tab === "summary" && (
          <p className="text-gray-800 leading-relaxed">{data.meeting_summary}</p>
        )}

        {tab === "actions" && (
          <div className="overflow-x-auto">
            {data.action_items.length === 0 ? (
              <p className="text-sm text-gray-500">No action items extracted.</p>
            ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="pb-2 pr-4 font-medium">Task</th>
                  <th className="pb-2 pr-4 font-medium">Owner</th>
                  <th className="pb-2 pr-4 font-medium">Deadline</th>
                  <th className="pb-2 pr-4 font-medium">Confidence</th>
                  <th className="pb-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.action_items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 pr-4 align-top">{item.task}</td>
                    <td className="py-3 pr-4 align-top">{item.owner}</td>
                    <td className="py-3 pr-4 align-top">{item.deadline || "—"}</td>
                    <td className="py-3 pr-4 align-top">
                      <ConfidenceBadge level={item.confidence} />
                    </td>
                    <td className="py-3 align-top text-gray-500 text-xs italic max-w-xs">
                      {item.source_quote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {tab === "decisions" && (
          data.decisions.length === 0 ? (
            <p className="text-sm text-gray-500">No decisions recorded.</p>
          ) : (
          <ul className="space-y-4">
            {data.decisions.map((d, i) => (
              <li key={i} className="border-l-2 border-gray-300 pl-4">
                <p className="font-medium">{d.decision}</p>
                {(d.made_by !== "Not specified" || d.timestamp_approx !== "—") && (
                  <p className="text-sm text-gray-500 mt-1">
                    {d.made_by !== "Not specified" && <span>{d.made_by}</span>}
                    {d.made_by !== "Not specified" && d.timestamp_approx !== "—" && " · "}
                    {d.timestamp_approx !== "—" && <span>{d.timestamp_approx}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
          )
        )}

        {tab === "questions" && (
          data.unresolved_questions.length === 0 ? (
            <p className="text-sm text-gray-500">No open questions.</p>
          ) : (
          <ul className="space-y-4">
            {data.unresolved_questions.map((q, i) => (
              <li key={i}>
                <p className="font-medium">{q.question}</p>
                {(q.raised_by !== "Not specified" || q.context) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {q.raised_by !== "Not specified" && <>Raised by {q.raised_by}</>}
                    {q.raised_by !== "Not specified" && q.context && " — "}
                    {q.context}
                  </p>
                )}
              </li>
            ))}
          </ul>
          )
        )}

        {tab === "slack" && slackOutput && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => copy(slackOutput, "slack")}
              className="no-print text-sm px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              {copied === "slack" ? "Copied!" : "Copy Slack draft"}
            </button>
            <pre className="whitespace-pre-wrap text-sm font-sans bg-gray-50 p-4 rounded-md border">
              {slackOutput}
            </pre>
          </div>
        )}

        {tab === "email" && emailOutput && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => copy(emailOutput.replace(/<[^>]+>/g, ""), "email")}
              className="no-print text-sm px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              {copied === "email" ? "Copied!" : "Copy email text"}
            </button>
            <div
              className="prose prose-sm max-w-none border rounded-md p-4 bg-gray-50"
              dangerouslySetInnerHTML={{ __html: emailOutput }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
