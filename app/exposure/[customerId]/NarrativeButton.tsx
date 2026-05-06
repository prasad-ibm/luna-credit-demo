"use client";

import { useState } from "react";

type Props = {
  customer_name: string;
  risk_class: string;
  total_ar: number;
  total_overdue: number;
  avg_days_to_pay: number;
  delinquency_flag: boolean;
  probability_of_default: number | null;
  recent_events: string;
};

export function NarrativeButton(props: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const data = await res.json();
      setText(data.text ?? data.error ?? "Error generating narrative.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!text && (
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md border bg-card hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Generating…" : "✦ AI credit narrative"}
        </button>
      )}
      {text && (
        <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-900 leading-relaxed">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-blue-700">AI Credit Narrative</span>
            <button
              onClick={() => { setText(null); }}
              className="text-xs text-blue-400 hover:text-blue-600"
            >
              Regenerate
            </button>
          </div>
          {text}
        </div>
      )}
    </div>
  );
}
