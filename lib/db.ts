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
