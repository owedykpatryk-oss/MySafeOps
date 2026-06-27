#!/usr/bin/env node
/**
 * Attach jack@fessgroup.co.uk + maciej@fessgroup.co.uk to one FESS Group org (both admin).
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npm run provision:fess-group
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const ORG_SLUG = "fess-group";
const ORG_NAME = "FESS Group";
const MEMBER_EMAILS = ["jack@fessgroup.co.uk", "maciej@fessgroup.co.uk"];
const ROLE = "admin";

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("Dashboard → Project Settings → API → service_role key (never commit).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users || []).find((u) => String(u.email || "").toLowerCase() === target);
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  console.log(`Provisioning ${ORG_NAME} (${ORG_SLUG})…\n`);

  const resolved = [];
  for (const email of MEMBER_EMAILS) {
    const id = await findUserIdByEmail(email);
    if (!id) {
      console.error(`✗ ${email} — no auth user (sign up first, then re-run)`);
    } else {
      resolved.push({ email, id });
      console.log(`✓ ${email} → ${id}`);
    }
  }

  if (resolved.length === 0) {
    console.error("\nNo users found. Nothing to attach.");
    process.exit(1);
  }

  let orgId;
  const { data: existing, error: findErr } = await admin
    .from("organizations")
    .select("id, slug, name")
    .eq("slug", ORG_SLUG)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing?.id) {
    orgId = existing.id;
    const { error: updErr } = await admin.from("organizations").update({ name: ORG_NAME }).eq("id", orgId);
    if (updErr) throw updErr;
    console.log(`\nUsing existing org: ${ORG_SLUG} (${orgId})`);
  } else {
    const ownerId = resolved[0].id;
    const { data: created, error: insErr } = await admin
      .from("organizations")
      .insert({ slug: ORG_SLUG, name: ORG_NAME, owner_user_id: ownerId })
      .select("id")
      .single();
    if (insErr) throw insErr;
    orgId = created.id;
    console.log(`\nCreated org: ${ORG_SLUG} (${orgId}), owner ${resolved[0].email}`);
  }

  for (const { email, id } of resolved) {
    const { error: memErr } = await admin.from("org_memberships").upsert(
      { user_id: id, org_id: orgId, role: ROLE },
      { onConflict: "user_id" }
    );
    if (memErr) throw memErr;
    console.log(`  attached ${email} as ${ROLE}`);
  }

  console.log("\nDone. Both users should:");
  console.log("  1. Sign out and sign in again (or Settings → Refresh role from cloud)");
  console.log("  2. Confirm org slug is fess-group in the app bar");
  console.log("  3. Settings → Organisation → Apply FESS Group branding (logo + website)");
  console.log("\nBranding logo: /branding/fess-group-logo.png");
  console.log("Website: https://pl.fessgroup.co.uk/");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
