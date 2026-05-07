export const dynamic = "force-dynamic";

import { getViolationSummary, getViolations } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { AuditSearch } from "./AuditSearch";

const VIOLATION_META: Record<string, { label: string; control: string; description: string }> = {
  MASTER_DATA_NO_APPROVAL: {
    label: "Master Data — No Approval",
    control: "Control G",
    description: "Field changes on critical entities with no approval reference on record.",
  },
  SOD_SELF_APPROVAL: {
    label: "Segregation of Duties",
    control: "Control G",
    description: "Same user both requested and approved a change — direct SOD violation.",
  },
  STALE_CREDIT_REVIEW: {
    label: "Stale Credit Review",
    control: "Control A",
    description: "Credit profile not reviewed in over 12 months.",
  },
  BROKEN_PTP_NO_ESCALATION: {
    label: "Broken PTP — No Escalation",
    control: "Control E",
    description: "Promise-to-pay missed more than 7 days ago without an escalation activity.",
  },
  DISPUTE_SLA_BREACH: {
    label: "Dispute SLA Breach",
    control: "Control F",
    description: "Dispute open beyond 30-day resolution SLA.",
  },
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH:     "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW:      "bg-green-100 text-green-700 border-green-200",
};

export default async function SoxPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; code?: string }>;
}) {
  const sp = await searchParams;
  const [summary, violations] = await Promise.all([
    getViolationSummary(),
    getViolations({ severity: sp.severity, code: sp.code, limit: 200 }),
  ]);

  const totalViolations = summary.reduce((s, r) => s + parseInt(r.count), 0);
  const criticalCount   = summary.filter(r => r.severity === "CRITICAL").reduce((s, r) => s + parseInt(r.count), 0);
  const highCount       = summary.filter(r => r.severity === "HIGH").reduce((s, r) => s + parseInt(r.count), 0);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">SOX Controls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live control health across credit, AR, collections, and master data. Every violation is evidence-linked.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total violations</div>
          <div className="text-2xl font-semibold mt-1">{totalViolations.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Critical (SOD)</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">{criticalCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">High severity</div>
          <div className="text-2xl font-semibold mt-1 text-orange-600">{highCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Control areas affected</div>
          <div className="text-2xl font-semibold mt-1">{summary.length}</div>
        </div>
      </div>

      {/* Control health tiles */}
      <div className="mb-8">
        <div className="text-sm font-medium mb-3">Control health by violation type</div>
        <div className="grid grid-cols-5 gap-3">
          {summary.map((s) => {
            const meta = VIOLATION_META[s.violation_code];
            const isActive = sp.code === s.violation_code;
            return (
              <a
                key={s.violation_code}
                href={isActive ? "/sox" : `/sox?code=${s.violation_code}`}
                className={`rounded-lg border p-4 block hover:shadow-sm transition cursor-pointer ${
                  isActive ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SEVERITY_STYLE[s.severity] ?? ""}`}>
                    {s.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">{meta?.control ?? ""}</span>
                </div>
                <div className="text-xl font-semibold mb-1">{parseInt(s.count).toLocaleString()}</div>
                <div className="text-xs font-medium leading-tight">{meta?.label ?? s.violation_code}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">
                  {meta?.description}
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Violation inbox */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Violation inbox</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Click a control tile above to filter · showing {violations.length} of {totalViolations.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2">
            {["CRITICAL","HIGH","MEDIUM"].map((sev) => (
              <a
                key={sev}
                href={sp.severity === sev ? "/sox" : `/sox?severity=${sev}`}
                className={`text-xs px-2.5 py-1 rounded border ${
                  sp.severity === sev
                    ? SEVERITY_STYLE[sev]
                    : "bg-card hover:bg-slate-50"
                }`}
              >
                {sev}
              </a>
            ))}
            {(sp.severity || sp.code) && (
              <a href="/sox" className="text-xs text-muted-foreground hover:underline self-center ml-1">
                Reset
              </a>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Severity</th>
                <th className="px-4 py-2.5 font-medium">Violation</th>
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Occurred</th>
                <th className="px-4 py-2.5 font-medium">Evidence ID</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded border ${SEVERITY_STYLE[v.severity] ?? ""}`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-xs">
                      {VIOLATION_META[v.violation_code]?.label ?? v.violation_code}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{v.description}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{v.entity_name}</span>
                    <span className="text-xs text-muted-foreground ml-1">#{v.entity_id}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.actor ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(v.occurred_at)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.evidence_id}</td>
                </tr>
              ))}
              {violations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No violations match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit trail search */}
      <AuditSearch />
    </div>
  );
}
