"use client";

import { useEffect, useState } from "react";
import { getUserApiKey, setUserApiKey } from "@/lib/api";

interface Props {
  onKeyChange?: (hasKey: boolean) => void;
  showPrompt?: boolean; // when true, show expanded state (e.g. after rate limit)
}

export default function ApiKeyInput({ onKeyChange, showPrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("actionflow_user_api_key");
    if (stored) {
      setKey(stored);
      setUserApiKey(stored);
      setHasKey(true);
      onKeyChange?.(true);
    }
  }, [onKeyChange]);

  // Auto-expand when rate limited
  useEffect(() => {
    if (showPrompt && !hasKey) {
      setOpen(true);
    }
  }, [showPrompt, hasKey]);

  const handleSave = () => {
    const trimmed = key.trim();
    if (trimmed) {
      setUserApiKey(trimmed);
      localStorage.setItem("actionflow_user_api_key", trimmed);
      setHasKey(true);
      onKeyChange?.(true);
    } else {
      setUserApiKey(null);
      localStorage.removeItem("actionflow_user_api_key");
      setHasKey(false);
      onKeyChange?.(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setKey("");
    setUserApiKey(null);
    localStorage.removeItem("actionflow_user_api_key");
    setHasKey(false);
    onKeyChange?.(false);
    setSaved(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-start gap-2 text-left px-4 py-2.5 rounded-lg border-2 border-dashed transition-all ${
          hasKey
            ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            : "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400 animate-pulse-slow"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 flex-shrink-0 mt-0.5"
        >
          <path
            fillRule="evenodd"
            d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          {hasKey ? (
            <span className="text-sm font-medium">✓ Using Your API Key</span>
          ) : (
            <>
              <span className="text-sm font-medium block">🔑 Bring Your Own API Key</span>
              <span className="text-xs opacity-80 block mt-0.5">Default key limit may exceed — use your own for uninterrupted access</span>
            </>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border-2 border-gray-200 rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span className="text-lg">🔑</span> Google Gemini API Key
        </h3>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Rate limited? Use your own <strong>free</strong> API key from{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline font-medium hover:text-blue-800"
        >
          Google AI Studio ↗
        </a>
        <br />
        <span className="text-gray-400">Your key stays in your browser — never stored on our server.</span>
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your key here (AIza...)"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent font-mono"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!key.trim()}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
        >
          {saved ? "✓ Saved" : "Save"}
        </button>
      </div>
      {hasKey && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
        >
          Remove key &amp; use default
        </button>
      )}
    </div>
  );
}
