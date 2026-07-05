import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = readFileSync(resolve(root, "DOCS/FESS/Extra/MySafeOps_DEMO_BACKUP_import.json"), "utf8");
const userId = "0d97ebe8-a1ff-4515-ae8c-5f206fbb8efa";
const orgSlug = "owedykpatryk-0d97ebe8";
const tag = `$demo_json$${bundle}$demo_json$`;
const sql = `INSERT INTO public.app_sync (user_id, org_slug, payload, updated_at)
VALUES ('${userId}', '${orgSlug}', ${tag}::jsonb, now())
ON CONFLICT (user_id, org_slug) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();`;
writeFileSync(resolve(root, "DOCS/FESS/Extra/_demo_upsert.sql"), sql, "utf8");
console.log("Wrote SQL", sql.length, "bytes");
