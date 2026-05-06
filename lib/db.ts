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
