export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { fmtCurrency, fmtDate, fmtDays, riskColor, agingColor } from "@/lib/format";
import { ActionPane } from "./ActionPane";

export default async function InvoiceActionPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const id = parseInt(invoiceId, 10);
  if (isNaN(id)) notFound();

  const [row] = await query<any>(
    `SELECT * FROM credit_collections.mv_collections_worklist WHERE invoice_id = $1`,
    [id]
  );
  if (!row) notFound();

  const activities = await query<any>(
    `SELECT * FROM credit_collections.collection_activity
     WHERE invoice_id = $1 ORDER BY activity_date DESC LIMIT 10`,
    [id]
  );

  const recent_invoices = await query<any>(
    `SELECT i.invoice_id, i.invoice_date, i.due_date, i.invoice_amount,
            i.outstanding_amount, i.aging_bucket, i.status
     FROM credit_collections.invoice i
     JOIN credit_collections.account a ON a.account_id = i.account_id
     WHERE a.customer_id = $1 ORDER BY i.invoice_date DESC LIMIT 8`,
    [row.customer_id]
  );

  const [contact] = await query<any>(
    `SELECT * FROM credit_collections.contact
     WHERE customer_id = $1 AND is_active = TRUE
     ORDER BY CASE role WHEN 'AP' THEN 1 WHEN 'Treasury' THEN 2
                        WHEN 'Controller' THEN 3 WHEN 'CFO' THEN 4 ELSE 5 END
     LIMIT 1`,
    [row.customer_id]
  );

  const [summary] = await query<any>(
    `SELECT avg_days_to_pay, total_overdue_amount, delinquency_flag
     FROM credit_collections.customer_ar_summary WHERE customer_id = $1`,
    [row.customer_id]
  );

  const brokenPtpCount = activities.filter(
    (a: any) => a.promise_to_pay_date && new Date(a.promise_to_pay_date) < new Date()
  ).length;

  const historySummary = `Avg ${summary?.avg_days_to_pay ?? "?"}d to pay; ${brokenPtpCount} broken PTP(s) on this invoice; ${
    summary?.delinquency_flag ? "currently delinquent" : "current overall"
  }.`;

  const lastActivityStr = activities[0]
    ? `${activities[0].activity_type} on ${fmtDate(activities[0].activity_date)} (${activities[0].status})`
    : null;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/collections" className="text-sm text-muted-foreground hover:underline">
          ← Back to worklist
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* LEFT: Context */}
        <div className="col-span-2 space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold">{row.legal_name}</h1>
                <div className="text-sm text-muted-foreground mt-1">
                  Customer #{row.customer_id} · {row.country_code} · {row.industry_code}
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-1 rounded border ${riskColor(row.risk_class)}`}>
                  {row.risk_class}
                </span>
                {row.strategic_flag && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                    STRATEGIC
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground mb-3">Invoice in focus</div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              {[
                ["Invoice ID", `#${row.invoice_id}`],
                ["Outstanding", fmtCurrency(row.outstanding_amount, row.currency_code)],
                ["Days overdue", fmtDays(row.days_overdue)],
                ["Aging", row.aging_bucket],
                ["Invoice date", fmtDate(row.invoice_date)],
                ["Due date", fmtDate(row.due_date)],
                ["Status", row.status],
                ["Priority score", parseFloat(row.priority_score).toFixed(0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  {label === "Aging" ? (
                    <span className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded ${agingColor(value as string)}`}>
                      {value}
                    </span>
                  ) : (
                    <div className="mt-0.5 font-mono">{value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground mb-3">Activity timeline</div>
            {activities.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No prior activity.</div>
            ) : (
              <ul className="space-y-2.5">
                {activities.map((a: any) => (
                  <li key={a.activity_id} className="flex gap-3 text-sm">
                    <div className="text-muted-foreground w-28 shrink-0">
                      {fmtDate(a.activity_date)}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{a.activity_type}</span>
                      <span className="text-muted-foreground"> · {a.status}</span>
                      {a.promise_to_pay_date && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          PTP {fmtDate(a.promise_to_pay_date)}
                        </span>
                      )}
                      {a.collector_id && (
                        <span className="text-xs text-muted-foreground ml-2">
                          by {a.collector_id}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground mb-3">
              Recent invoices for this customer
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-1.5">ID</th>
                  <th className="py-1.5">Date</th>
                  <th className="py-1.5">Due</th>
                  <th className="py-1.5 text-right">Amount</th>
                  <th className="py-1.5 text-right">Outstanding</th>
                  <th className="py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent_invoices.map((inv: any) => (
                  <tr key={inv.invoice_id} className="border-b last:border-0">
                    <td className="py-1.5 font-mono text-xs">#{inv.invoice_id}</td>
                    <td className="py-1.5">{fmtDate(inv.invoice_date)}</td>
                    <td className="py-1.5">{fmtDate(inv.due_date)}</td>
                    <td className="py-1.5 text-right font-mono">
                      {fmtCurrency(inv.invoice_amount, row.currency_code)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {fmtCurrency(inv.outstanding_amount, row.currency_code)}
                    </td>
                    <td className="py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        inv.status === "CLOSED" ? "bg-green-50 text-green-700"
                        : inv.status === "DISPUTED" ? "bg-amber-50 text-amber-700"
                        : "bg-gray-50 text-gray-700"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Action pane */}
        <div className="col-span-1">
          <ActionPane
            invoiceId={row.invoice_id}
            customer={{
              legal_name: row.legal_name,
              country_code: row.country_code,
              industry_code: row.industry_code,
              risk_class: row.risk_class,
              strategic_flag: row.strategic_flag,
            }}
            contact={
              contact
                ? { name: contact.name, role: contact.role, email: contact.email, preferred_channel: contact.preferred_channel }
                : null
            }
            invoiceContext={{
              outstanding_amount: parseFloat(row.outstanding_amount),
              days_overdue: row.days_overdue,
              currency: row.currency_code,
              avg_days_to_pay: summary?.avg_days_to_pay ?? 30,
            }}
            historySummary={historySummary}
            lastActivity={lastActivityStr}
          />
        </div>
      </div>
    </div>
  );
}
