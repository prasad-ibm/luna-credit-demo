export const dynamic = "force-dynamic";

import Link from "next/link";
import { query } from "@/lib/db";
import { fmtCurrency, fmtDate, fmtDays, riskColor, agingColor } from "@/lib/format";

type WorklistRow = {
  invoice_id: number;
  customer_id: number;
  legal_name: string;
  country_code: string;
  industry_code: string;
  risk_class: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: string;
  outstanding_amount: string;
  aging_bucket: string;
  status: string;
  currency_code: string;
  days_overdue: number;
  last_activity_date: string | null;
  last_ptp_date: string | null;
  broken_ptp_flag: boolean;
  strategic_flag: boolean;
  priority_score: string;
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ broken?: string; risk?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  if (sp.broken === "1") where.push(`broken_ptp_flag = TRUE`);
  if (sp.risk) { params.push(sp.risk); where.push(`risk_class = $${params.length}`); }
  if (sp.q)    { params.push(`%${sp.q}%`); where.push(`legal_name ILIKE $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query<WorklistRow>(
    `SELECT * FROM credit_collections.mv_collections_worklist
     ${whereSql} ORDER BY priority_score DESC LIMIT 100`,
    params
  );

  const [kpi] = await query<{
    total_overdue: string;
    open_count: string;
    broken_ptp_count: string;
  }>(
    `SELECT
       COALESCE(SUM(outstanding_amount), 0) AS total_overdue,
       COUNT(*) AS open_count,
       SUM(CASE WHEN broken_ptp_flag THEN 1 ELSE 0 END) AS broken_ptp_count
     FROM credit_collections.mv_collections_worklist`
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Collections Copilot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prioritized worklist scored by exposure × risk × age × strategic boost × broken-PTP penalty.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total overdue</div>
          <div className="text-2xl font-semibold mt-1">{fmtCurrency(kpi.total_overdue)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Open invoices in queue</div>
          <div className="text-2xl font-semibold mt-1">{kpi.open_count}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Broken PTPs</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">{kpi.broken_ptp_count}</div>
        </div>
      </div>

      <form className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text" name="q" defaultValue={sp.q ?? ""}
          placeholder="Search customer..."
          className="border rounded-md px-3 py-1.5 text-sm w-64"
        />
        <select name="risk" defaultValue={sp.risk ?? ""} className="border rounded-md px-3 py-1.5 text-sm">
          <option value="">All risk classes</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="WATCH">Watch</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="broken" value="1" defaultChecked={sp.broken === "1"} />
          Broken PTPs only
        </label>
        <button type="submit" className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90">
          Apply
        </button>
        <Link href="/collections" className="text-sm text-muted-foreground hover:underline">
          Reset
        </Link>
      </form>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium text-right">Outstanding</th>
              <th className="px-4 py-2.5 font-medium">Age</th>
              <th className="px-4 py-2.5 font-medium">Aging</th>
              <th className="px-4 py-2.5 font-medium">Last activity</th>
              <th className="px-4 py-2.5 font-medium">Flags</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice_id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs">
                  {parseFloat(r.priority_score).toFixed(0)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.legal_name}</div>
                  <div className="text-xs text-muted-foreground">
                    #{r.customer_id} · {r.country_code} · {r.industry_code}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded border ${riskColor(r.risk_class)}`}>
                    {r.risk_class}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {fmtCurrency(r.outstanding_amount, r.currency_code)}
                </td>
                <td className="px-4 py-2.5">{fmtDays(r.days_overdue)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded ${agingColor(r.aging_bucket)}`}>
                    {r.aging_bucket}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {fmtDate(r.last_activity_date)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {r.broken_ptp_flag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        BROKEN PTP
                      </span>
                    )}
                    {r.strategic_flag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        STRATEGIC
                      </span>
                    )}
                    {r.status === "DISPUTED" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        DISPUTED
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/collections/${r.invoice_id}`} className="text-sm text-primary hover:underline font-medium">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No invoices match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
