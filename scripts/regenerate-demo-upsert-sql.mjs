#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(
  resolve(__dirname, "../DOCS/FESS/Extra/MySafeOps_DEMO_BACKUP_import.json"),
  "utf8",
);
const sql = `INSERT INTO public.app_sync (user_id, org_slug, payload, updated_at)
VALUES ('0d97ebe8-a1ff-4515-ae8c-5f206fbb8efa', 'owedykpatryk-0d97ebe8', $json$${bundle}$json$::jsonb, now())
ON CONFLICT (user_id, org_slug) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();`;
const out = resolve(__dirname, "../DOCS/FESS/Extra/_demo_upsert_fresh.sql");
writeFileSync(out, sql, "utf8");
console.log(`Wrote ${out} (${Buffer.byteLength(sql)} bytes)`);
