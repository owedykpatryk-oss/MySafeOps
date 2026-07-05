#!/usr/bin/env node
/**
 * Seed demo documents for a Supabase user via app_sync cloud backup.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (or pass --dry-run to only write JSON).
 *
 * Usage:
 *   node scripts/provision-demo-data.mjs owedykpatryk@gmail.com
 *   node scripts/provision-demo-data.mjs owedykpatryk@gmail.com --dry-run
 */
import { config } from "dotenv";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { buildDemoSeedBundle } from "./lib/demoSeedBundle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const email = (process.argv[2] || "owedykpatryk@gmail.com").trim().toLowerCase();
const dryRun = process.argv.includes("--dry-run");

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

async function findUserIdByEmail(admin, targetEmail) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users || []).find((u) => String(u.email || "").toLowerCase() === targetEmail);
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  console.log(`Demo seed for ${email}${dryRun ? " (dry-run)" : ""}…`);

  if (!url) {
    console.error("Missing VITE_SUPABASE_URL");
    process.exit(1);
  }

  let userId = null;
  let orgSlug = null;

  if (serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      console.error(`No auth user for ${email} — sign up first.`);
      process.exit(1);
    }
    const { data: mem, error: memErr } = await admin
      .from("org_memberships")
      .select("org_id, organizations(slug)")
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw memErr;
    orgSlug = mem?.organizations?.slug;
    if (!orgSlug) {
      console.error("User has no organisation membership.");
      process.exit(1);
    }
  } else {
    console.warn("No SUPABASE_SERVICE_ROLE_KEY — using defaults for dry bundle only.");
    orgSlug = process.env.DEMO_ORG_SLUG || "owedykpatryk-0d97ebe8";
    userId = process.env.DEMO_USER_ID || "0d97ebe8-a1ff-4515-ae8c-5f206fbb8efa";
  }

  const bundle = buildDemoSeedBundle(orgSlug);
  const outPath = resolve(__dirname, "../DOCS/FESS/Extra/MySafeOps_DEMO_BACKUP_import.json");
  writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`  keys: ${bundle.meta.keyCount}, permits: ${bundle.meta.permitCount}, RAMS: ${bundle.meta.ramsCount}`);

  if (dryRun || !serviceKey) {
    console.log("\nDry-run complete. Import manually: Backup → Restore, or add SUPABASE_SERVICE_ROLE_KEY and re-run.");
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.from("app_sync").upsert(
    {
      user_id: userId,
      org_slug: orgSlug,
      payload: bundle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,org_slug" }
  );
  if (error) throw error;

  console.log(`\nCloud backup updated for ${email} (org: ${orgSlug}).`);
  console.log("Sign in → Settings → Backup → Download from cloud (or refresh browser) to pull demo data.");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
