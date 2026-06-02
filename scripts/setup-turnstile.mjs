#!/usr/bin/env node
/**
 * Turnstile rollout helper — reads/writes .env.local, never prints secrets.
 *
 *   node scripts/setup-turnstile.mjs              # .env.local test site key
 *   node scripts/setup-turnstile.mjs --vercel     # + Vercel Production & Preview
 *   node scripts/setup-turnstile.mjs --supabase   # + Supabase Management API (needs token)
 *   node scripts/setup-turnstile.mjs --all        # vercel + supabase + cloudflare (if tokens)
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");

const TEST_SITE = "1x00000000000000000000AA";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

const flags = new Set(process.argv.slice(2));
const runVercel = flags.has("--vercel") || flags.has("--all");
const runSupabase = flags.has("--supabase") || flags.has("--all");
const runCloudflare = flags.has("--cloudflare") || flags.has("--all");

function loadEnv() {
  if (existsSync(envLocal)) dotenv.config({ path: envLocal });
}

function projectRefFromUrl(url) {
  const m = String(url || "").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] || "";
}

function upsertEnvLocalKey(key, value) {
  if (!existsSync(envLocal)) {
    writeFileSync(envLocal, `${key}=${value}\n`, "utf8");
    return;
  }
  const raw = readFileSync(envLocal, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(raw)) {
    writeFileSync(envLocal, raw.replace(re, `${key}=${value}`), "utf8");
  } else {
    writeFileSync(envLocal, `${raw.replace(/\s*$/, "")}\n${key}=${value}\n`, "utf8");
  }
}

async function patchSupabaseAuth({ ref, token, secret }) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      security_captcha_enabled: true,
      security_captcha_provider: "turnstile",
      security_captcha_secret: secret,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase PATCH auth (${res.status}): ${text.slice(0, 400)}`);
  }
  console.log(`✓ Supabase ${ref}: Turnstile captcha enabled.`);
  console.log(`  https://supabase.com/dashboard/project/${ref}/auth/protection`);
}

async function createCloudflareWidget({ accountId, token, hostname }) {
  const domains = [hostname, "localhost", "127.0.0.1"].filter(Boolean);
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "MySafeOps auth",
      domains,
      mode: "managed",
    }),
  });
  const json = await res.json();
  if (!json?.success) {
    throw new Error(`Cloudflare: ${JSON.stringify(json?.errors || json).slice(0, 500)}`);
  }
  const result = json.result || {};
  const sitekey = result.sitekey || result.site_key;
  const secret = result.secret;
  if (!sitekey || !secret) throw new Error("Cloudflare response missing sitekey/secret");
  console.log(`✓ Cloudflare widget (domains: ${domains.join(", ")}).`);
  return { siteKey: sitekey, secret };
}

function addVercelEnv(name, value, environments) {
  for (const env of environments) {
    try {
      execSync(`npx vercel env add ${name} ${env} --force`, {
        cwd: root,
        input: `${value}\n`,
        stdio: ["pipe", "inherit", "inherit"],
        encoding: "utf8",
      });
      console.log(`✓ Vercel ${name} → ${env}`);
    } catch (e) {
      console.warn(`⚠ Vercel ${name} (${env}): ${e?.message || "failed"}`);
    }
  }
}

async function main() {
  execFileSync(process.execPath, [resolve(__dirname, "ensure-turnstile-env.mjs")], {
    cwd: root,
    stdio: "inherit",
  });

  loadEnv();

  let siteKey = (process.env.VITE_TURNSTILE_SITE_KEY || "").trim() || TEST_SITE;
  let secret = (process.env.TURNSTILE_SECRET_KEY || "").trim() || TEST_SECRET;

  const ref =
    projectRefFromUrl(process.env.VITE_SUPABASE_URL) || "burgpzankkqvpcmdkhro";
  const publicSite = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/+$/, "");
  let hostname = "mysafeops.com";
  try {
    hostname = new URL(publicSite).hostname;
  } catch {
    /* keep default */
  }

  if (runCloudflare && process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    const created = await createCloudflareWidget({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID.trim(),
      token: process.env.CLOUDFLARE_API_TOKEN.trim(),
      hostname,
    });
    siteKey = created.siteKey;
    secret = created.secret;
    upsertEnvLocalKey("VITE_TURNSTILE_SITE_KEY", siteKey);
    upsertEnvLocalKey("TURNSTILE_SECRET_KEY", secret);
    console.log("✓ .env.local updated with Cloudflare keys (values not printed).");
  } else if (runCloudflare) {
    console.log("· Cloudflare skipped: set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in .env.local");
  }

  if (runSupabase) {
    const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
    let supabaseOk = false;
    try {
      execSync(`npx supabase config push --project-ref ${ref} --yes`, {
        cwd: root,
        stdio: "pipe",
        encoding: "utf8",
      });
      console.log(`✓ Supabase ${ref}: auth config pushed (Turnstile + production URLs from supabase/config.toml).`);
      supabaseOk = true;
    } catch (e) {
      const out = String(e?.stdout || e?.stderr || e?.message || "");
      if (/access token|not logged in|unauthorized/i.test(out)) {
        console.log("· Supabase CLI not authenticated — run: npx supabase login");
      } else {
        console.warn(`⚠ supabase config push: ${out.slice(0, 300)}`);
      }
    }
    if (!supabaseOk && token) {
      await patchSupabaseAuth({ ref, token, secret });
      supabaseOk = true;
    }
    if (!supabaseOk) {
      console.log("  Optional: SUPABASE_ACCESS_TOKEN in .env.local for Management API fallback");
      console.log(`  Manual: https://supabase.com/dashboard/project/${ref}/auth/protection`);
    }
  }

  if (runVercel) {
    if (!existsSync(resolve(root, ".vercel"))) {
      console.log("· Linking Vercel project…");
      execSync("npx vercel link --yes", { cwd: root, stdio: "inherit" });
    }
    addVercelEnv("VITE_TURNSTILE_SITE_KEY", siteKey, ["production", "preview"]);
    console.log("  Redeploy Production/Preview in Vercel so the new VITE_* reaches the bundle.");
  }

  if (!runSupabase && !runVercel && !runCloudflare) {
    console.log("\nNext:");
    console.log("  node scripts/setup-turnstile.mjs --vercel");
    console.log("  node scripts/setup-turnstile.mjs --supabase --vercel");
    console.log(`  Supabase manual: https://supabase.com/dashboard/project/${ref}/auth/protection`);
    console.log(`  Test secret (pairs with site key ${TEST_SITE}): Cloudflare test secret in Dashboard only.`);
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
