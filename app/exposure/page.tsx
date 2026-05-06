import {
  getPortfolioSummary,
  getPortfolioByRisk,
  getHierarchyRollup,
  getLimitBreachWatchlist,
} from "@/lib/db";
import { fmtCurrency, riskColor } from "@/lib/format";
import { PortfolioChart } from "./PortfolioChart";

export default async function ExposurePage() {
  const [summary, byRisk, hierarchy, watchlist] = await Promise.all([
    getPortfolioSummary(),
    getPortfolioByRisk(),
    getHierarchyRollup(20),
    getLimitBreachWatchlist(30),
  ]);

  const totalAr      = parseFloat(summary.total_ar ?? "0");
  const totalOverdue = parseFloat(summary.total_overdue ?? "0");
  const overdueRate  = totalAr > 0 ? (totalOverdue / totalAr) * 100 : 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio Exposure</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Luna Telecom enterprise AR — credit utilization, hierarchy rollup, and limit breach watchlist.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total AR</div>
          <div className="text-2xl font-semibold mt-1">{fmtCurrency(summary.total_ar)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Overdue AR</div>
          <div className="text-2xl font-semibold mt-1 text-orange-600">{fmtCurrency(summary.total_overdue)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{overdueRate.toFixed(1)}% of portfolio</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Customers on hold</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">
            {parseInt(summary.customers_on_hold ?? "0").toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Active customers</div>
          <div className="text-2xl font-semibold mt-1">
            {parseInt(summary.customers_active ?? "0").toLocaleString()}
          </div>
        </div>
      </div>

      {/* Risk breakdown */}
      <div className="grid grid-cols-5 gap-6 mb-8">
        <div className="col-span-3 rounded-lg border bg-card p-5">
          <div className="text-sm font-medium mb-4">AR by risk class</div>
          <PortfolioChart data={byRisk} />
        </div>
        <div className="col-span-2 rounded-lg border bg-card p-5">
          <div className="text-sm font-medium mb-3">Risk breakdown</div>
          <div className="space-y-2">
            {byRisk.map((r) => {
              const ar      = parseFloat(r.total_ar);
              const overdue = parseFloat(r.total_overdue);
              const pct     = totalAr > 0 ? (ar / totalAr) * 100 : 0;
              return (
                <div key={r.risk_class} className="flex items-center gap-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium w-16 text-center ${riskColor(r.risk_class)}`}>
                    {r.risk_class}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium">{fmtCurrency(ar)}</span>
                      <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtCurrency(overdue)} overdue · {parseInt(r.customer_count).toLocaleString()} customers
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hierarchy rollup */}
      <div className="mb-8">
        <div className="mb-3">
          <div className="text-sm font-medium">Parent hierarchy rollup</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Consolidated exposure across corporate families · top 20 by utilization
          </div>
        </div>
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Parent entity</th>
                <th className="px-4 py-2.5 font-medium text-right">Entities</th>
                <th className="px-4 py-2.5 font-medium text-right">Consolidated AR</th>
                <th className="px-4 py-2.5 font-medium text-right">Overdue</th>
                <th className="px-4 py-2.5 font-medium text-right">Credit limit</th>
                <th className="px-4 py-2.5 font-medium text-right">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {hierarchy.map((h) => {
                const util = parseFloat(h.utilization_pct ?? "0");
                const utilColor = util >= 90 ? "text-red-600 font-semibold"
                  : util >= 75 ? "text-orange-600 font-medium"
                  : "text-foreground";
                return (
                  <tr key={h.root_customer_id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <a
                        href={`/exposure/${h.root_customer_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {h.root_legal_name}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {h.entity_count}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {fmtCurrency(h.consolidated_ar_balance)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-orange-600">
                      {fmtCurrency(h.consolidated_overdue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {h.consolidated_limit ? fmtCurrency(h.consolidated_limit) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right ${utilColor}`}>
                      {h.utilization_pct ? `${parseFloat(h.utilization_pct).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
              {hierarchy.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No multi-entity hierarchies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Limit breach watchlist */}
      <div>
        <div className="mb-3">
          <div className="text-sm font-medium">Credit limit breach watchlist</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Customers sorted by limit utilization · top 30
          </div>
        </div>
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Risk</th>
                <th className="px-4 py-2.5 font-medium text-right">AR balance</th>
                <th className="px-4 py-2.5 font-medium text-right">Credit limit</th>
                <th className="px-4 py-2.5 font-medium text-right">Utilization</th>
                <th className="px-4 py-2.5 font-medium text-right">Overdue</th>
                <th className="px-4 py-2.5 font-medium">Delinquent</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((w) => {
                const util = parseFloat(w.utilization_pct ?? "0");
                const utilColor = util >= 90 ? "text-red-600 font-semibold"
                  : util >= 75 ? "text-orange-600 font-medium"
                  : "text-foreground";
                return (
                  <tr key={w.customer_id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <a
                        href={`/exposure/${w.customer_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {w.legal_name}
                      </a>
                      <div className="text-xs text-muted-foreground">{w.country_code}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${riskColor(w.risk_class)}`}>
                        {w.risk_class}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {fmtCurrency(w.total_ar_balance)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {w.approved_limit ? fmtCurrency(w.approved_limit) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right ${utilColor}`}>
                      {w.utilization_pct ? `${parseFloat(w.utilization_pct).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-orange-600">
                      {fmtCurrency(w.total_overdue_amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      {w.delinquency_flag ? (
                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">Yes</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {watchlist.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No customers in watchlist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
