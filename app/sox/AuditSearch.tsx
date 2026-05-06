"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/format";

type AuditRow = {
  audit_id: number;
  entity_name: string;
  entity_id: number;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  change_timestamp: string;
  approval_reference: string | null;
};

export function AuditSearch() {
  const [form, setForm] = useState({
    entity_name: "", entity_id: "", changed_by: "", from_date: "", to_date: "",
  });
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(form).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      setRows(data);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm({ entity_name: "", entity_id: "", changed_by: "", from_date: "", to_date: "" });
    setRows([]);
    setSearched(false);
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="font-medium mb-1">Audit Trail Search</div>
      <div className="text-xs text-muted-foreground mb-4">
        Full-text search across all field-level changes. Export results as evidence for SOX testing.
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Entity type</label>
          <select
            value={form.entity_name}
            onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
            className="border rounded-md px-2.5 py-1.5 text-sm"
          >
            <option value="">All entities</option>
            <option value="credit_limit">credit_limit</option>
            <option value="account">account</option>
            <option value="customer">customer</option>
            <option value="contract">contract</option>
            <option value="collection_activity">collection_activity</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Entity ID</label>
          <input
            type="number"
            value={form.entity_id}
            onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
            placeholder="e.g. 11042"
            className="border rounded-md px-2.5 py-1.5 text-sm w-32"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Changed by</label>
          <input
            type="text"
            value={form.changed_by}
            onChange={(e) => setForm({ ...form, changed_by: e.target.value })}
            placeholder="user.01"
            className="border rounded-md px-2.5 py-1.5 text-sm w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From date</label>
          <input
            type="date"
            value={form.from_date}
            onChange={(e) => setForm({ ...form, from_date: e.target.value })}
            className="border rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To date</label>
          <input
            type="date"
            value={form.to_date}
            onChange={(e) => setForm({ ...form, to_date: e.target.value })}
            className="border rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
        {searched && (
          <button type="button" onClick={handleReset} className="text-sm text-muted-foreground hover:underline">
            Reset
          </button>
        )}
      </form>

      {searched && (
        <>
          <div className="text-xs text-muted-foreground mb-2">
            {rows.length} record{rows.length !== 1 ? "s" : ""} found
            {rows.length === 300 && " (showing first 300 — narrow your search)"}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Audit ID</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Old value</th>
                  <th className="px-3 py-2 font-medium">New value</th>
                  <th className="px-3 py-2 font-medium">Changed by</th>
                  <th className="px-3 py-2 font-medium">Timestamp</th>
                  <th className="px-3 py-2 font-medium">Approval ref</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.audit_id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.audit_id}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.entity_name}</span>
                      <span className="text-xs text-muted-foreground ml-1">#{r.entity_id}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{r.field_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px] truncate">{r.old_value ?? "—"}</td>
                    <td className="px-3 py-2 text-xs max-w-[120px] truncate">{r.new_value ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.changed_by}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(r.change_timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      {r.approval_reference ? (
                        <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                          {r.approval_reference}
                        </span>
                      ) : (
                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                          missing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No records match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
