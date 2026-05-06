"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tone = "friendly" | "firm" | "final-notice";
type Channel = "EMAIL" | "CALL" | "DUNNING_LETTER";

export function ActionPane({
  invoiceId, customer, contact, invoiceContext, historySummary, lastActivity,
}: {
  invoiceId: number;
  customer: { legal_name: string; country_code: string; industry_code: string; risk_class: string; strategic_flag: boolean };
  contact: { name: string; role: string; email: string; preferred_channel: string } | null;
  invoiceContext: { outstanding_amount: number; days_overdue: number; currency: string; avg_days_to_pay: number };
  historySummary: string;
  lastActivity: string | null;
}) {
  const router = useRouter();
  const [tone, setTone] = useState<Tone>("firm");
  const [channel, setChannel] = useState<Channel>(
    (contact?.preferred_channel === "PHONE" ? "CALL" : "EMAIL") as Channel
  );
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [ptpDate, setPtpDate] = useState("");
  const [ptpRationale, setPtpRationale] = useState("");
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    setError(null);
    setDrafting(true);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          contact: contact ?? { name: "Accounts Payable", role: "AP" },
          invoices: [{ invoice_id: invoiceId, outstanding_amount: invoiceContext.outstanding_amount, days_overdue: invoiceContext.days_overdue, currency: invoiceContext.currency }],
          history_summary: historySummary,
          last_activity: lastActivity,
          tone,
          channel,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDraft(data.text);
    } catch (e: any) {
      setError(e.message ?? "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSuggestPtp() {
    setError(null);
    try {
      const res = await fetch("/api/suggest-ptp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customer.legal_name,
          avg_days_to_pay: invoiceContext.avg_days_to_pay,
          outstanding: invoiceContext.outstanding_amount,
          currency: invoiceContext.currency,
          history_summary: historySummary,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.ptp_date) setPtpDate(data.ptp_date);
      if (data.rationale) setPtpRationale(data.rationale);
    } catch (e: any) {
      setError(e.message ?? "PTP suggestion failed");
    }
  }

  async function handleLog() {
    setError(null);
    setLogging(true);
    try {
      const res = await fetch("/api/log-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          activity_type: channel,
          collector_id: "COL001",
          promise_to_pay_date: ptpDate || null,
          status: "COMPLETED",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLogged(true);
      setTimeout(() => router.refresh(), 800);
    } catch (e: any) {
      setError(e.message ?? "Logging failed");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 sticky top-6">
      <div className="text-sm font-medium mb-1">Action pane</div>
      <div className="text-xs text-muted-foreground mb-4">
        {contact
          ? `${contact.name} · ${contact.role} · ${contact.preferred_channel}`
          : "No active contact on file"}
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground block mb-1.5">Channel</label>
        <div className="flex gap-1.5">
          {(["EMAIL", "CALL", "DUNNING_LETTER"] as Channel[]).map((c) => (
            <button key={c} onClick={() => setChannel(c)}
              className={`text-xs px-2.5 py-1 rounded border ${channel === c ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
              {c.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground block mb-1.5">Tone</label>
        <div className="flex gap-1.5">
          {(["friendly", "firm", "final-notice"] as Tone[]).map((t) => (
            <button key={t} onClick={() => setTone(t)}
              className={`text-xs px-2.5 py-1 rounded border capitalize ${tone === t ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleDraft} disabled={drafting}
        className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
        {drafting ? "Drafting..." : draft ? "Re-draft" : "Draft message"}
      </button>

      {draft && (
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          rows={14}
          className="mt-3 w-full text-sm font-mono p-3 border rounded-md resize-y bg-muted/20" />
      )}

      <div className="mt-4 pt-4 border-t">
        <label className="text-xs text-muted-foreground block mb-1.5">Promise-to-pay date</label>
        <div className="flex gap-2">
          <input type="date" value={ptpDate} onChange={(e) => setPtpDate(e.target.value)}
            className="flex-1 text-sm border rounded-md px-2 py-1.5" />
          <button onClick={handleSuggestPtp}
            className="text-xs px-2.5 py-1 border rounded-md hover:bg-muted">
            Suggest
          </button>
        </div>
        {ptpRationale && (
          <div className="text-xs text-muted-foreground mt-1.5 italic">{ptpRationale}</div>
        )}
      </div>

      <button onClick={handleLog} disabled={logging || logged}
        className="mt-4 w-full py-2 text-sm font-medium border-2 border-primary text-primary rounded-md hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50">
        {logged ? "✓ Logged" : logging ? "Logging..." : "Log activity & audit"}
      </button>

      {error && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>
      )}
    </div>
  );
}
