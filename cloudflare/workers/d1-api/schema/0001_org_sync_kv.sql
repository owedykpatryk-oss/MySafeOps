-- D1: generic org-scoped JSON blobs (permits, RAMS, registers — one row per key).
-- Access control is enforced in the Worker (Supabase membership check), not in D1.

CREATE TABLE IF NOT EXISTS org_sync_kv (
  org_slug TEXT NOT NULL,
  namespace TEXT NOT NULL,
  data_key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (org_slug, namespace, data_key)
);

CREATE INDEX IF NOT EXISTS idx_org_sync_kv_updated
  ON org_sync_kv (org_slug, updated_at);
