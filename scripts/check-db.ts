import { Client } from "pg";

async function run() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const checks: [string, string][] = [
    ["Customers",            "SELECT COUNT(*) FROM credit_collections.customer"],
    ["Invoices",             "SELECT COUNT(*) FROM credit_collections.invoice"],
    ["Payments",             "SELECT COUNT(*) FROM credit_collections.payment"],
    ["Worklist (overdue)",   "SELECT COUNT(*) FROM credit_collections.mv_collections_worklist"],
    ["Total AR outstanding", "SELECT SUM(outstanding_amount)::bigint FROM credit_collections.invoice WHERE status != 'CLOSED'"],
    ["SOX violations",       "SELECT COUNT(*) FROM credit_collections.v_sox_violations"],
    ["Broken PTPs",          "SELECT COUNT(*) FROM credit_collections.mv_collections_worklist WHERE broken_ptp_flag = TRUE"],
  ];

  for (const [label, sql] of checks) {
    const r = await c.query(sql);
    const val = Object.values(r.rows[0])[0];
    console.log(label.padEnd(25), Number(val).toLocaleString());
  }
  await c.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
