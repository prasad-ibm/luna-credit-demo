# Credit Workbench

AgenticSAP demo: agentic credit, collections, and SOX controls over a SAP-style
`credit_collections` schema. Three tabs:

1. **Exposure** — portfolio heatmap + parent/child rollup *(Tab 1: stub)*
2. **Collections** — Claude-powered worklist + draft + log *(Tab 2: live)*
3. **SOX** — control violations + audit search *(Tab 3: stub)*

Stack: Next.js 16 · Postgres · Claude API (Sonnet 4.6 with prompt caching).

---

## Local development

```bash
npm install
cp .env.example .env.local       # fill in DATABASE_URL and ANTHROPIC_API_KEY
npm run setup-db                 # applies db/schema.sql + db/views.sql
# Then load seed data (one-time, from your machine):
#   python ../seed_credit_collections.py --sql
#   psql $DATABASE_URL -f ../seed_data/inserts.sql
npm run dev
```

Visit http://localhost:3000 — redirects to `/collections`.

---

## Deploy to Railway

1. **Push this repo to GitHub** (see "Git" section below).
2. **Create a Railway project**: https://railway.app/new → "Deploy from GitHub repo" → pick this repo.
3. **Add Postgres**: Project → "+ New" → "Database" → "Add PostgreSQL". Railway auto-injects `DATABASE_URL`.
4. **Set environment variables** on the web service:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - (`DATABASE_URL` is auto-set by the Postgres add-on)
5. **Deploy** — Railway detects Next.js via Nixpacks. First build takes ~3 min.
6. **Initialize the database** (one-time, from your laptop):
   ```bash
   # Get the public DATABASE_URL from Railway → Postgres → Connect → Public Network
   export DATABASE_URL="postgres://...railway..."

   # Apply schema + views via Node (no psql needed)
   npm run setup-db

   # Generate + load seed data
   python ../seed_credit_collections.py --sql
   psql "$DATABASE_URL" -f ../seed_data/inserts.sql

   # Refresh materialized views
   npm run refresh-views
   ```
7. **Visit your Railway domain** — it should land on `/collections` with a populated worklist.
8. **Optional cron** — Railway → "+ New" → "Cron Job" → command: `npm run refresh-views`, schedule: `*/30 * * * *`.

### Why setup-db runs from your laptop, not the server
Railway's runtime image doesn't have `psql`. The `setup-db` script uses the `pg`
Node client to apply the SQL files, so it works anywhere Node + `DATABASE_URL`
work. The seed-data load uses `psql` only because it's faster for ~80k rows;
you can run it from any machine that has `psql` installed.

---

## Project layout

```
app\
├── layout.tsx                  Root layout with top nav
├── page.tsx                    Redirects to /collections
├── exposure\page.tsx           Tab 1 (stub)
├── sox\page.tsx                Tab 3 (stub)
├── collections\
│   ├── page.tsx                Scored worklist
│   └── [invoiceId]\
│       ├── page.tsx            Server-rendered context
│       └── ActionPane.tsx      Client interactions
└── api\
    ├── draft\route.ts          Claude draft endpoint
    ├── suggest-ptp\route.ts    Claude PTP suggestion
    └── log-activity\route.ts   Insert activity + audit log
db\
├── schema.sql                  14 tables + indexes + sequences
└── views.sql                   3 materialized views + SOX violations view
lib\
├── claude.ts                   Claude integration (cached system prompt)
├── db.ts                       Postgres client + typed queries
└── format.ts                   Currency/date/risk formatters
scripts\
├── setup-db.ts                 Apply schema + views via pg client
└── refresh-views.ts            Refresh materialized views (for cron)
railway.json                    Railway deploy config
```
