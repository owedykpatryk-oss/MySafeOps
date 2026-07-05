#!/usr/bin/env node
/**
 * Enable Stripe QA test buttons in Settings → Billing (live checkout unchanged).
 *
 *   node scripts/setup-stripe-test-checkout.mjs              # .env.local only
 *   node scripts/setup-stripe-test-checkout.mjs --vercel     # + Vercel Production & Preview
 *   node scripts/setup-stripe-test-checkout.mjs --supabase   # stripe:setup-test + db push
 *   node scripts/setup-stripe-test-checkout.mjs --all        # everything
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");

const flags = new Set(process.argv.slice(2));
const runVercel = flags.has("--vercel") || flags.has("--all");
const runSupabase = flags.has("--supabase") || flags.has("--all");

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

function projectRefFromUrl(url) {
  const m = String(url || "").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] || "";
}

async function main() {
  dotenv.config({ path: envLocal });
  dotenv.config({ path: resolve(root, ".env") });

  upsertEnvLocalKey("VITE_STRIPE_ALLOW_TEST_CHECKOUT", "true");
  console.log("✓ .env.local: VITE_STRIPE_ALLOW_TEST_CHECKOUT=true");

  if (runSupabase) {
    console.log("\nStripe test secrets + migration…");
    execFileSync(process.execPath, [resolve(__dirname, "stripe-setup-test-mode.mjs")], {
      cwd: root,
      stdio: "inherit",
    });

    const ref = projectRefFromUrl(process.env.VITE_SUPABASE_URL) || "burgpzankkqvpcmdkhro";
    try {
      execSync(`npx supabase link --project-ref ${ref} --yes`, {
        cwd: root,
        stdio: "pipe",
        encoding: "utf8",
      });
      execSync("npx supabase db push --yes", {
        cwd: root,
        stdio: "inherit",
        encoding: "utf8",
      });
      console.log(`✓ Supabase ${ref}: migrations applied (stripe_test_customer_id).`);
    } catch (e) {
      console.warn(`⚠ supabase db push: ${e?.message || "failed"} — apply migration manually if needed.`);
    }

    try {
      execSync("npx supabase functions deploy stripe-checkout stripe-portal stripe-webhook --project-ref " + ref, {
        cwd: root,
        stdio: "inherit",
        encoding: "utf8",
      });
      console.log("✓ Edge Functions redeployed.");
    } catch (e) {
      console.warn(`⚠ functions deploy: ${e?.message || "failed"}`);
    }

    execFileSync(process.execPath, [resolve(__dirname, "billing-doctor.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
  }

  if (runVercel) {
    if (!existsSync(resolve(root, ".vercel"))) {
      console.log("· Linking Vercel project…");
      execSync("npx vercel link --yes", { cwd: root, stdio: "inherit" });
    }
    addVercelEnv("VITE_STRIPE_ALLOW_TEST_CHECKOUT", "true", ["production", "preview"]);
    console.log("\n· Triggering Production redeploy…");
    try {
      execSync("npx vercel deploy --prod --yes", { cwd: root, stdio: "inherit" });
      console.log("✓ Production redeploy started.");
    } catch (e) {
      console.warn(`⚠ vercel deploy --prod: ${e?.message || "failed"}`);
      console.log("  Manual: Vercel Dashboard → Deployments → Redeploy latest Production build.");
    }
  }

  if (!runSupabase && !runVercel) {
    console.log("\nNext:");
    console.log("  node scripts/setup-stripe-test-checkout.mjs --supabase --vercel");
    console.log("  npm run billing:doctor");
  } else {
    console.log("\nAfter deploy: Settings → Billing → QA — Stripe test mode (Org Admin).");
    console.log("Test card: 4242 4242 4242 4242 · Live Subscribe buttons unchanged.\n");
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
