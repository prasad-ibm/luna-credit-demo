import { Client } from "pg";
async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("SELECT legal_name, country_code, industry_code FROM credit_collections.customer LIMIT 8");
  console.log("Sample customers:");
  r.rows.forEach((row: any) => console.log(" ", row.country_code, row.industry_code, row.legal_name));
  const cur = await c.query("SELECT DISTINCT currency_code FROM credit_collections.account ORDER BY 1");
  console.log("Currencies:", cur.rows.map((r: any) => r.currency_code).join(", "));
  await c.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
