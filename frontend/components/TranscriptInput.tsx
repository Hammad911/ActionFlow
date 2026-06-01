"use client";

import { useRef } from "react";
import { SAMPLE_TRANSCRIPT } from "@/lib/api";

const MAX_CHARS = 50000;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onProcess: () => void;
  onFileUpload: (file: File) => void;
  loading: boolean;
  warning?: string | null;
}

export default function TranscriptInput({
  value,
  onChange,
  onProcess,
  onFileUpload,
  loading,
  warning,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Meeting Transcript</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(SAMPLE_TRANSCRIPT)}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Load sample
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.docx,.vtt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileUpload(f);
            }}
          />
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Paste your meeting transcript here — Zoom exports, manual notes, speaker labels all work..."
        className="w-full h-64 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
      />

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {wordCount.toLocaleString()} words · {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
        </span>
        {wordCount > 0 && wordCount < 100 && (
          <span className="text-amber-600 font-medium">
            This transcript may be too short for reliable extraction
          </span>
        )}
      </div>

      {warning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          {warning}
        </div>
      )}

      <button
        type="button"
        onClick={onProcess}
        disabled={loading || !value.trim()}
        className="w-full sm:w-auto px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
      >
        {loading ? "Processing…" : "Extract Actions"}
      </button>
    </div>
  );
}
