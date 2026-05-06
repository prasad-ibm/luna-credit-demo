/**
 * Applies db/schema.sql + db/views.sql to the Postgres pointed to by DATABASE_URL.
 *
 * Run locally against your Railway DB:
 *   DATABASE_URL=postgres://... npm run setup-db
 *
 * Or as a one-time Railway job (Settings → Deploy → Custom Start Command):
 *   npm run setup-db && npm start
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes("railway") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  console.log("Connected to Postgres");

  const files = ["db/schema.sql", "db/views.sql"];
  for (const f of files) {
    const sql = readFileSync(resolve(process.cwd(), f), "utf-8");
    console.log(`Applying ${f}...`);
    await client.query(sql);
  }

  console.log("Refreshing materialized views...");
  await client.query("REFRESH MATERIALIZED VIEW credit_collections.mv_parent_exposure_rollup");
  await client.query("REFRESH MATERIALIZED VIEW credit_collections.mv_collections_worklist");

  await client.end();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
