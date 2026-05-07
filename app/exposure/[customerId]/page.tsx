import { getCustomer360, getCustomerCollectionActivity } from "@/lib/db";
import { fmtCurrency, fmtDate, riskColor, agingColor } from "@/lib/format";
import { NarrativeButton } from "./NarrativeButton";
import { notFound } from "next/navigation";

export default async function Customer360Page({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const id = parseInt(customerId);
  if (isNaN(id)) notFound();

  const [{ customer, limit, contacts, recent_invoices, risk_events, disputes, children }, activities] =
    await Promise.all([
      getCustomer360(id),
      getCustomerCollectionActivity(id),
    ]);

  if (!customer) notFound();

  const approvedLimit  = parseFloat(limit?.approved_limit ?? "0");
  const totalAr        = parseFloat(customer.total_ar_balance ?? "0");
  const totalOverdue   = parseFloat(customer.total_overdue_amount ?? "0");
  const utilizationPct = approvedLimit > 0 ? (totalAr / approvedLimit) * 100 : null;

  const recentEventSummary = risk_events
    .slice(0, 3)
    .map((e: any) => `${e.event_type} (${fmtDate(e.event_date)})`)
    .join("; ");

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground mb-4">
        <a href="/exposure" className="hover:underline">Exposure</a>
        <span className="mx-1.5">›</span>
        <span>{customer.legal_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.legal_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${riskColor(customer.risk_class)}`}>
              {customer.risk_class ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">{customer.country_code}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{customer.industry_code}</span>
            {customer.strategic_flag && (
              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                Strategic
              </span>
            )}
            {customer.credit_hold_flag && (
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">
                Credit Hold
              </span>
            )}
          </div>
          {customer.parent_name && (
            <div className="text-xs text-muted-foreground mt-1">
              Parent: {customer.parent_name}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/collections?q=${encodeURIComponent(customer.legal_name)}`}
            className="text-xs px-3 py-1.5 rounded-md border bg-card hover:bg-slate-50"
          >
            Open in Collections →
          </a>
          <NarrativeButton
            customer_name={customer.legal_name}
            risk_class={customer.risk_class ?? "MEDIUM"}
            total_ar={totalAr}
            total_overdue={totalOverdue}
            avg_days_to_pay={Math.round(parseFloat(customer.avg_days_to_pay ?? "30"))}
            delinquency_flag={customer.delinquency_flag ?? false}
            probability_of_default={customer.probability_of_default ? parseFloat(customer.probability_of_default) : null}
            recent_events={recentEventSummary}
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total AR</div>
          <div className="text-xl font-semibold mt-1">{fmtCurrency(customer.total_ar_balance)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Overdue</div>
          <div className="text-xl font-semibold mt-1 text-orange-600">{fmtCurrency(customer.total_overdue_amount)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Credit limit</div>
          <div className="text-xl font-semibold mt-1">{approvedLimit ? fmtCurrency(approvedLimit) : "—"}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Utilization</div>
          <div className={`text-xl font-semibold mt-1 ${utilizationPct != null && utilizationPct >= 90 ? "text-red-600" : utilizationPct != null && utilizationPct >= 75 ? "text-orange-600" : ""}`}>
            {utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Avg days to pay</div>
          <div className="text-xl font-semibold mt-1">
            {customer.avg_days_to_pay ? Math.round(parseFloat(customer.avg_days_to_pay)) : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="col-span-2 space-y-6">
          {/* Recent invoices */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <div className="text-sm font-medium">Recent invoices</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-xs">Invoice</th>
                  <th className="px-4 py-2 font-medium text-xs">Invoice date</th>
                  <th className="px-4 py-2 font-medium text-xs">Due date</th>
                  <th className="px-4 py-2 font-medium text-xs text-right">Amount</th>
                  <th className="px-4 py-2 font-medium text-xs text-right">Outstanding</th>
                  <th className="px-4 py-2 font-medium text-xs">Aging</th>
                  <th className="px-4 py-2 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent_invoices.map((inv: any) => (
                  <tr key={inv.invoice_id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">{inv.invoice_id}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-2 text-xs text-right">{fmtCurrency(inv.invoice_amount)}</td>
                    <td className="px-4 py-2 text-xs text-right font-medium">{fmtCurrency(inv.outstanding_amount)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${agingColor(inv.aging_bucket)}`}>
                        {inv.aging_bucket ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{inv.status}</td>
                  </tr>
                ))}
                {recent_invoices.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-xs">No invoices found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Disputes */}
          {disputes.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50">
                <div className="text-sm font-medium">Open disputes</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-xs">Dispute ID</th>
                    <th className="px-4 py-2 font-medium text-xs">Invoice</th>
                    <th className="px-4 py-2 font-medium text-xs">Type</th>
                    <th className="px-4 py-2 font-medium text-xs text-right">Amount</th>
                    <th className="px-4 py-2 font-medium text-xs">Status</th>
                    <th className="px-4 py-2 font-medium text-xs">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((d: any) => (
                    <tr key={d.dispute_id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">{d.dispute_id}</td>
                      <td className="px-4 py-2 font-mono text-xs">{d.invoice_id}</td>
                      <td className="px-4 py-2 text-xs">{d.dispute_type}</td>
                      <td className="px-4 py-2 text-xs text-right">{fmtCurrency(d.disputed_amount)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{d.status}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(d.opened_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Risk events */}
          {risk_events.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50">
                <div className="text-sm font-medium">Risk events</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-xs">Type</th>
                    <th className="px-4 py-2 font-medium text-xs">Severity</th>
                    <th className="px-4 py-2 font-medium text-xs">Date</th>
                    <th className="px-4 py-2 font-medium text-xs">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {risk_events.map((e: any) => (
                    <tr key={e.risk_event_id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs font-medium">{e.event_type}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          e.severity === "HIGH" ? "bg-orange-50 text-orange-700" :
                          e.severity === "CRITICAL" ? "bg-red-50 text-red-700" :
                          "bg-yellow-50 text-yellow-700"
                        }`}>
                          {e.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(e.event_date)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Collection activity */}
          {activities.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                <div className="text-sm font-medium">Collection activity</div>
                <a
                  href={`/collections?q=${encodeURIComponent(customer.legal_name)}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open in Collections →
                </a>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-xs">Type</th>
                    <th className="px-4 py-2 font-medium text-xs">Invoice</th>
                    <th className="px-4 py-2 font-medium text-xs">Date</th>
                    <th className="px-4 py-2 font-medium text-xs">PTP date</th>
                    <th className="px-4 py-2 font-medium text-xs">Status</th>
                    <th className="px-4 py-2 font-medium text-xs">Collector</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.activity_id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs font-medium">{a.activity_type}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{a.invoice_id}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(a.activity_date)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(a.promise_to_pay_date)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{a.status}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{a.collector_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">
          {/* Credit profile */}
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium mb-3">Credit profile</div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Internal rating</dt>
                <dd className="font-medium">{customer.internal_rating ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">External score</dt>
                <dd className="font-medium">{customer.external_score ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Prob. of default</dt>
                <dd className="font-medium">
                  {customer.probability_of_default
                    ? `${(parseFloat(customer.probability_of_default) * 100).toFixed(1)}%`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last review</dt>
                <dd>{fmtDate(customer.last_review_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delinquent</dt>
                <dd>{customer.delinquency_flag ? (
                  <span className="text-red-600 font-medium">Yes</span>
                ) : "No"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Oldest invoice</dt>
                <dd>{fmtDate(customer.oldest_invoice_date)}</dd>
              </div>
            </dl>
          </div>

          {/* Contacts */}
          {contacts.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium mb-3">Contacts</div>
              <div className="space-y-2">
                {contacts.map((c: any) => (
                  <div key={c.contact_id} className="text-xs">
                    <div className="font-medium">{c.contact_name}</div>
                    <div className="text-muted-foreground">{c.role} · {c.email}</div>
                    {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subsidiary entities */}
          {children.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium mb-3">Subsidiary entities</div>
              <div className="space-y-2">
                {children.map((ch: any) => (
                  <div key={ch.customer_id} className="text-xs">
                    <a href={`/exposure/${ch.customer_id}`} className="font-medium text-primary hover:underline">
                      {ch.legal_name}
                    </a>
                    <div className="text-muted-foreground">
                      AR: {fmtCurrency(ch.total_ar_balance)} · Overdue: {fmtCurrency(ch.total_overdue_amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
