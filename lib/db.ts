import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function sslConfig() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("localhost") || url.includes("127.0.0.1")) return undefined;
  return { rejectUnauthorized: false };
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig(),
    max: 10,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

export async function query<T = unknown>(sql: string, params: unknown[] = []) {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function logActivity(args: {
  invoice_id: number;
  activity_type: string;
  collector_id: string;
  promise_to_pay_date?: string | null;
  status?: string;
}) {
  await query(
    `INSERT INTO credit_collections.collection_activity
       (activity_id, invoice_id, activity_type, activity_date,
        promise_to_pay_date, status, collector_id)
     VALUES (nextval('credit_collections.collection_activity_seq_workbench'), $1, $2, NOW(), $3, $4, $5)`,
    [
      args.invoice_id,
      args.activity_type,
      args.promise_to_pay_date ?? null,
      args.status ?? "COMPLETED",
      args.collector_id,
    ]
  );
  await query(
    `INSERT INTO credit_collections.audit_log
       (audit_id, entity_name, entity_id, field_name, old_value, new_value,
        changed_by, change_timestamp, approval_reference)
     VALUES (nextval('credit_collections.audit_log_seq_workbench'), 'collection_activity', $1,
             'activity_type', NULL, $2, $3, NOW(), NULL)`,
    [args.invoice_id, args.activity_type, args.collector_id]
  );
}

export async function refreshViews() {
  await query(`REFRESH MATERIALIZED VIEW credit_collections.mv_parent_exposure_rollup`);
  await query(`REFRESH MATERIALIZED VIEW credit_collections.mv_collections_worklist`);
}

// ---------- Tab 1: Exposure ----------

export async function getAgingBuckets() {
  return query<{ aging_bucket: string; invoice_count: string; outstanding: string }>(`
    SELECT
      i.aging_bucket,
      COUNT(*)                              AS invoice_count,
      COALESCE(SUM(i.outstanding_amount),0) AS outstanding
    FROM credit_collections.invoice i
    JOIN credit_collections.account a ON a.account_id = i.account_id
    JOIN credit_collections.customer c ON c.customer_id = a.customer_id
    WHERE i.status NOT IN ('PAID','CANCELLED') AND c.status = 'ACTIVE'
    GROUP BY i.aging_bucket
    ORDER BY CASE i.aging_bucket
      WHEN 'CURRENT' THEN 1 WHEN '30' THEN 2 WHEN '60' THEN 3 WHEN '90+' THEN 4 ELSE 5 END
  `);
}

export async function getCustomerCollectionActivity(customer_id: number) {
  return query<{
    activity_id: number; invoice_id: number; activity_type: string;
    activity_date: string; promise_to_pay_date: string | null;
    status: string; collector_id: string;
  }>(`
    SELECT ca.activity_id, ca.invoice_id, ca.activity_type,
           ca.activity_date, ca.promise_to_pay_date, ca.status, ca.collector_id
    FROM credit_collections.collection_activity ca
    JOIN credit_collections.invoice i  ON i.invoice_id = ca.invoice_id
    JOIN credit_collections.account a  ON a.account_id = i.account_id
    WHERE a.customer_id = $1
    ORDER BY ca.activity_date DESC
    LIMIT 20
  `, [customer_id]);
}

export async function getPortfolioSummary() {
  const [kpi] = await query<{
    total_ar: string; total_overdue: string;
    customers_on_hold: string; customers_active: string;
  }>(`
    SELECT
      COALESCE(SUM(s.total_ar_balance), 0)     AS total_ar,
      COALESCE(SUM(s.total_overdue_amount), 0) AS total_overdue,
      COUNT(*) FILTER (WHERE a.credit_hold_flag = TRUE) AS customers_on_hold,
      COUNT(DISTINCT c.customer_id) AS customers_active
    FROM credit_collections.customer c
    LEFT JOIN credit_collections.customer_ar_summary s ON s.customer_id = c.customer_id
    LEFT JOIN credit_collections.account a              ON a.customer_id = c.customer_id
    WHERE c.status = 'ACTIVE'
  `);
  return kpi;
}

export async function getPortfolioByRisk() {
  return query<{ risk_class: string; customer_count: string; total_ar: string; total_overdue: string }>(`
    SELECT
      cp.risk_class,
      COUNT(DISTINCT c.customer_id) AS customer_count,
      COALESCE(SUM(s.total_ar_balance), 0)     AS total_ar,
      COALESCE(SUM(s.total_overdue_amount), 0) AS total_overdue
    FROM credit_collections.customer c
    JOIN credit_collections.credit_profile cp       ON cp.customer_id = c.customer_id
    LEFT JOIN credit_collections.customer_ar_summary s ON s.customer_id = c.customer_id
    WHERE c.status = 'ACTIVE'
    GROUP BY cp.risk_class
    ORDER BY CASE cp.risk_class WHEN 'WATCH' THEN 1 WHEN 'HIGH' THEN 2
                                WHEN 'MEDIUM' THEN 3 ELSE 4 END
  `);
}

export async function getHierarchyRollup(limit = 20) {
  return query<{
    root_customer_id: number; root_legal_name: string; entity_count: string;
    consolidated_ar_balance: string; consolidated_overdue: string;
    consolidated_limit: string; utilization_pct: string;
  }>(`
    SELECT * FROM credit_collections.mv_parent_exposure_rollup
    WHERE entity_count > 1
    ORDER BY utilization_pct DESC NULLS LAST LIMIT $1
  `, [limit]);
}

export async function getLimitBreachWatchlist(limit = 30) {
  return query<{
    customer_id: number; legal_name: string; country_code: string;
    risk_class: string; total_ar_balance: string; approved_limit: string;
    utilization_pct: string; total_overdue_amount: string; delinquency_flag: boolean;
  }>(`
    SELECT
      c.customer_id, c.legal_name, c.country_code,
      cp.risk_class,
      s.total_ar_balance, s.total_overdue_amount, s.delinquency_flag,
      cl.approved_limit,
      CASE WHEN cl.approved_limit > 0
           THEN ROUND(s.total_ar_balance / cl.approved_limit * 100, 1)
           ELSE NULL END AS utilization_pct
    FROM credit_collections.customer c
    JOIN credit_collections.credit_profile cp ON cp.customer_id = c.customer_id
    JOIN credit_collections.customer_ar_summary s ON s.customer_id = c.customer_id
    LEFT JOIN LATERAL (
      SELECT SUM(cl2.approved_limit) AS approved_limit
      FROM credit_collections.credit_limit cl2
      WHERE cl2.credit_profile_id = cp.credit_profile_id
        AND cl2.effective_date <= CURRENT_DATE
        AND (cl2.expiry_date IS NULL OR cl2.expiry_date >= CURRENT_DATE)
    ) cl ON TRUE
    WHERE c.status = 'ACTIVE' AND s.total_ar_balance > 0
    ORDER BY utilization_pct DESC NULLS LAST
    LIMIT $1
  `, [limit]);
}

export async function getCustomer360(customer_id: number) {
  const [customer] = await query<any>(`
    SELECT c.*, cp.risk_class, cp.internal_rating, cp.external_score,
           cp.probability_of_default, cp.last_review_date,
           s.total_ar_balance, s.total_overdue_amount,
           s.avg_days_to_pay, s.delinquency_flag, s.oldest_invoice_date,
           parent.legal_name AS parent_name
    FROM credit_collections.customer c
    LEFT JOIN credit_collections.credit_profile cp    ON cp.customer_id = c.customer_id
    LEFT JOIN credit_collections.customer_ar_summary s ON s.customer_id = c.customer_id
    LEFT JOIN credit_collections.customer parent       ON parent.customer_id = c.parent_customer_id
    WHERE c.customer_id = $1
  `, [customer_id]);

  const [limit] = await query<any>(`
    SELECT SUM(cl.approved_limit) AS approved_limit
    FROM credit_collections.credit_limit cl
    JOIN credit_collections.credit_profile cp ON cp.credit_profile_id = cl.credit_profile_id
    WHERE cp.customer_id = $1
      AND cl.effective_date <= CURRENT_DATE
      AND (cl.expiry_date IS NULL OR cl.expiry_date >= CURRENT_DATE)
  `, [customer_id]);

  const contacts = await query<any>(`
    SELECT * FROM credit_collections.contact
    WHERE customer_id = $1 AND is_active ORDER BY
      CASE role WHEN 'AP' THEN 1 WHEN 'Treasury' THEN 2 WHEN 'CFO' THEN 3 ELSE 4 END
  `, [customer_id]);

  const recent_invoices = await query<any>(`
    SELECT i.invoice_id, i.invoice_date, i.due_date, i.invoice_amount,
           i.outstanding_amount, i.aging_bucket, i.status, a.currency_code
    FROM credit_collections.invoice i
    JOIN credit_collections.account a ON a.account_id = i.account_id
    WHERE a.customer_id = $1 ORDER BY i.invoice_date DESC LIMIT 12
  `, [customer_id]);

  const risk_events = await query<any>(`
    SELECT re.* FROM credit_collections.risk_event re
    JOIN credit_collections.credit_profile cp ON cp.credit_profile_id = re.credit_profile_id
    WHERE cp.customer_id = $1 ORDER BY re.event_date DESC LIMIT 8
  `, [customer_id]);

  const disputes = await query<any>(`
    SELECT d.*, i.invoice_date FROM credit_collections.dispute d
    JOIN credit_collections.invoice i  ON i.invoice_id = d.invoice_id
    JOIN credit_collections.account a  ON a.account_id = i.account_id
    WHERE a.customer_id = $1 ORDER BY i.invoice_date DESC LIMIT 6
  `, [customer_id]);

  const children = await query<any>(`
    SELECT c.customer_id, c.legal_name, s.total_ar_balance, s.total_overdue_amount
    FROM credit_collections.customer c
    LEFT JOIN credit_collections.customer_ar_summary s ON s.customer_id = c.customer_id
    WHERE c.parent_customer_id = $1
  `, [customer_id]);

  return { customer, limit, contacts, recent_invoices, risk_events, disputes, children };
}

// ---------- Tab 3: SOX ----------

export async function getViolationSummary() {
  return query<{ violation_code: string; severity: string; count: string }>(`
    SELECT violation_code, severity, COUNT(*) AS count
    FROM credit_collections.v_sox_violations
    GROUP BY violation_code, severity
    ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END
  `);
}

export async function getViolations(opts?: { severity?: string; code?: string; limit?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.severity) { params.push(opts.severity); where.push(`severity = $${params.length}`); }
  if (opts?.code)     { params.push(opts.code);     where.push(`violation_code = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(opts?.limit ?? 200);
  return query<{
    violation_code: string; severity: string; description: string;
    evidence_id: number; entity_name: string; entity_id: number;
    actor: string; occurred_at: string;
  }>(`
    SELECT * FROM credit_collections.v_sox_violations
    ${whereSql} ORDER BY occurred_at DESC LIMIT $${params.length}
  `, params);
}

export async function searchAuditTrail(opts: {
  entity_name?: string; entity_id?: string;
  changed_by?: string; from_date?: string; to_date?: string;
}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.entity_name) { params.push(opts.entity_name); where.push(`entity_name = $${params.length}`); }
  if (opts.entity_id)   { params.push(parseInt(opts.entity_id)); where.push(`entity_id = $${params.length}`); }
  if (opts.changed_by)  { params.push(`%${opts.changed_by}%`); where.push(`changed_by ILIKE $${params.length}`); }
  if (opts.from_date)   { params.push(opts.from_date); where.push(`change_timestamp >= $${params.length}`); }
  if (opts.to_date)     { params.push(opts.to_date);   where.push(`change_timestamp <= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return query<{
    audit_id: number; entity_name: string; entity_id: number;
    field_name: string; old_value: string; new_value: string;
    changed_by: string; change_timestamp: string; approval_reference: string;
  }>(`
    SELECT * FROM credit_collections.audit_log
    ${whereSql} ORDER BY change_timestamp DESC LIMIT 300
  `, params);
}
