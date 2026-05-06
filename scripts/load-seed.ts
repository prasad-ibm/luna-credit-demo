/**
 * Loads seed_data/inserts.sql into Postgres via the pg client.
 * Splits on statement boundaries to avoid hitting single-query size limits.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL required"); process.exit(1); }

  const client = new Client({
    connectionString: url,
    ssl: url.includes("railway") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  console.log("Connected.");

  const sql = readFileSync(resolve(process.cwd(), "../seed_data/inserts.sql"), "utf-8");

  // Split into individual INSERT statements
  const statements = sql
    .split("\n")
    .filter((l) => l.startsWith("INSERT INTO"))
    .map((l) => l.trim());

  console.log(`Loading ${statements.length.toLocaleString()} INSERT statements...`);

  // Execute in batches of 500 for throughput
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH).join("\n");
    await client.query(chunk);
    done += Math.min(BATCH, statements.length - i);
    if (done % 5000 === 0 || done === statements.length) {
      process.stdout.write(`  ${done.toLocaleString()} / ${statements.length.toLocaleString()}\r`);
    }
  }

  console.log("\nRefreshing materialized views...");
  await client.query("REFRESH MATERIALIZED VIEW credit_collections.mv_parent_exposure_rollup");
  await client.query("REFRESH MATERIALIZED VIEW credit_collections.mv_collections_worklist");

  await client.end();
  console.log("Done.");
}

run().catch((e) => { console.error(e); process.exit(1); });
