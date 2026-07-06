#!/usr/bin/env node
/**
 * CE evidence: verify latest D1 snapshot exists in R2 and JSON is restorable shape.
 * Usage: npm run d1:backup:test-restore
 *
 * Requires: wrangler logged in (OAuth) or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in .env.local.
 * R2 bucket: mysafeops-files (see d1-backup wrangler.toml).
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");
const BUCKET = process.env.D1_BACKUP_R2_BUCKET || "mysafeops-files";
const PREFIX = "d1-snapshots/";
const DEFAULT_ACCOUNT_ID = "18efbdd5472a2d731ef6fe63b0df2c9b";

if (existsSync(envLocal)) dotenv.config({ path: envLocal });

function wrangler(args) {
  return spawnSync("npx", ["wrangler@3", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

function readWranglerOAuthToken() {
  const cfg = join(process.env.APPDATA || "", "xdg.config", ".wrangler", "config", "default.toml");
  if (!existsSync(cfg)) return "";
  const m = readFileSync(cfg, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
  return m?.[1]?.trim() || "";
}

function cloudflareAuth() {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || readWranglerOAuthToken();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || DEFAULT_ACCOUNT_ID;
  if (!token) return null;
  return { token, accountId };
}

async function listR2Objects(auth) {
  const objects = [];
  let cursor;
  for (let page = 0; page < 20; page++) {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${auth.accountId}/r2/buckets/${BUCKET}/objects`
    );
    url.searchParams.set("prefix", PREFIX);
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const body = await res.json();
    if (!body.success) {
      const msg = body.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
      throw new Error(`R2 list failed: ${msg}`);
    }
    const batch = Array.isArray(body.result) ? body.result : body.result?.objects || [];
    objects.push(...batch);
    cursor = body.result?.cursor;
    if (!cursor || !batch.length) break;
  }
  return objects;
}

function objectTimestamp(obj) {
  return String(obj?.last_modified || obj?.uploaded || obj?.key || "");
}

async function main() {
  console.log("D1 backup restore test (read-only)\n");

  const auth = cloudflareAuth();
  if (!auth) {
    console.error("✗ Missing Cloudflare auth — run `npx wrangler login` or set CLOUDFLARE_API_TOKEN in .env.local");
    process.exit(1);
  }

  let objects;
  try {
    objects = await listR2Objects(auth);
  } catch (e) {
    console.error(`✗ ${e?.message || e}`);
    process.exit(1);
  }

  if (!objects.length) {
    console.error(`✗ No objects under ${BUCKET}/${PREFIX} — wait for cron (03:00 UTC) or check d1-backup worker.`);
    process.exit(1);
  }

  objects.sort((a, b) => objectTimestamp(b).localeCompare(objectTimestamp(a)));
  const latest = objects[0];
  const key = latest.key;
  const size = latest.size ?? latest.content_length ?? "?";
  const uploaded = objectTimestamp(latest) || "?";
  console.log(`✓ Latest snapshot: ${key} (${size} bytes, ${uploaded})`);

  const tmp = mkdtempSync(resolve(tmpdir(), "mysafeops-d1-restore-"));
  const outFile = resolve(tmp, "snapshot.json");
  try {
    const objectPath = `${BUCKET}/${key}`;
    const get = wrangler(["r2", "object", "get", objectPath, `--file=${outFile}`]);
    if (get.status !== 0) {
      console.error("✗ r2 object get failed");
      console.error((get.stderr || get.stdout || "").trim());
      process.exit(1);
    }

    const raw = readFileSync(outFile, "utf8");
    const dump = JSON.parse(raw);
    if (dump?.meta?.kind !== "mysafeops_d1_dump") {
      console.error("✗ Invalid dump meta.kind");
      process.exit(1);
    }
    const kv = Array.isArray(dump.org_sync_kv) ? dump.org_sync_kv.length : 0;
    const audit = Array.isArray(dump.org_audit_log) ? dump.org_audit_log.length : 0;
    console.log(`✓ JSON valid — org_sync_kv rows: ${kv}, org_audit_log rows: ${audit}`);
    console.log(`✓ exported_at: ${dump.meta.exported_at || "?"}`);
    console.log("\nRestore test passed (structure only). For full DR: import selected org_sync_kv rows via d1:import-backup or SQL.");
    console.log("\nCE evidence: save this console output + screenshot of R2 object list to CE-2026-evidence/backup/\n");
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
