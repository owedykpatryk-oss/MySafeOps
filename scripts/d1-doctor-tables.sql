SELECT name FROM sqlite_master WHERE type='table' AND name IN ('org_sync_kv', 'org_audit_log') ORDER BY name;
