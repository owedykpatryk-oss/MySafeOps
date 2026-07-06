-- Per-actor API rate buckets (D1 Worker — KV PUT + audit append).
CREATE TABLE IF NOT EXISTS org_api_rate (
  bucket_key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS org_api_rate_window_idx ON org_api_rate (window_start);
