-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- D1 (SQLite) ONLY — do NOT run in Supabase SQL Editor (Postgres: no AUTOINCREMENT).
-- Apply to Cloudflare D1, e.g. from repo root:
--   npx wrangler@3 d1 execute mysafeops-d1 --remote --file=cloudflare/workers/d1-api/schema/0002_org_audit_log.sql
-- (Use your real database name / --local for dev.)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Append-only audit log with hash chain (HMAC key on Worker only, not in browser).
-- entry_hash = HMAC(AUDIT_CHAIN_SECRET, prev_hash + "\n" + canonical_json)

CREATE TABLE IF NOT EXISTS org_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_slug TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  actor_sub TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  detail TEXT,
  client_row_id TEXT,
  payload_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  UNIQUE (org_slug, seq)
);

CREATE INDEX IF NOT EXISTS idx_org_audit_org_seq ON org_audit_log (org_slug, seq DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_org_created ON org_audit_log (org_slug, created_at DESC);
