-- Index for per-actor audit append rate limiting in d1-api Worker.
CREATE INDEX IF NOT EXISTS org_audit_log_actor_recent_idx
  ON org_audit_log (org_slug, actor_sub, created_at);
