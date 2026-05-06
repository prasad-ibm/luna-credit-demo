/**
 * Refreshes materialized views. Wire this into a Railway cron (e.g., every 30 min).
 */
import { Client } from "pg";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
  const client = new Client({
    connectionString: url,
    ssl: url.includes("railway") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  await client.query("REFRESH MATERIALIZED VIEW credit_collections.mv_parent_exposure_rollup");
  await client.query("REFRESH MATERIALIZED VIEW credit_collections.mv_collections_worklist");
  await client.end();
  console.log("Views refreshed.");
}
run().catch((e) => { console.error(e); process.exit(1); });
