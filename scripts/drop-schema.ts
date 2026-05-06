import { Client } from "pg";
async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS credit_collections CASCADE;");
  console.log("Schema dropped.");
  await c.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
