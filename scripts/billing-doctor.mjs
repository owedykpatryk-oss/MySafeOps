#!/usr/bin/env node
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const baseUrl = process.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, "");
const anon = process.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!baseUrl) {
  console.error("Missing VITE_SUPABASE_URL in .env.local / env.");
  process.exit(1);
}

if (!anon) {
  console.warn("Warning: VITE_SUPABASE_ANON_KEY is not set. Browser auth/features may fail.");
}

const functionsToCheck = ["stripe-checkout", "stripe-portal", "stripe-webhook"];

function fmt(status) {
  return status ? "ok" : "missing";
}

async function checkFunction(fnName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${baseUrl}/functions/v1/${fnName}`, {
      method: "GET",
      signal: controller.signal,
    });
    if (res.status === 404) {
      return { fnName, deployed: false, configured: null, rawStatus: 404 };
    }
    const body = await res.json().catch(() => null);
    const liveReady = body?.liveReady === true;
    const testReady = body?.testReady === true;
    if (body?.configured && typeof body.configured === "object") {
      const liveKeys = [
        "stripeSecretKey",
        "stripePriceStarter",
        "stripePriceTeam",
        "stripePriceBusiness",
        "stripePriceEnterprise",
        "siteUrl",
        "supabaseUrl",
        "serviceRoleKey",
      ];
      const configured =
        body.liveReady === true ||
        (body.liveReady !== false && liveKeys.every((k) => Boolean(body.configured[k])));
      const valid = body?.valid && typeof body.valid === "object" ? Object.values(body.valid).every(Boolean) : true;
      return {
        fnName,
        deployed: true,
        configured,
        valid,
        liveReady,
        testReady,
        configuredMap: body.configured,
        validMap: body.valid || {},
        pendingFailures: Number.isFinite(body?.pendingFailures) ? Number(body.pendingFailures) : null,
        lastProcessedAt: body?.lastProcessedAt || null,
        marketBilling: body?.marketBilling || null,
        rawStatus: res.status,
      };
    }
    // Unauthenticated probes get the public health body, which deliberately omits the
    // detailed `configured` map but still answers readiness. Keep those flags, otherwise
    // every run without a billing-admin token reports a false failure.
    return { fnName, deployed: true, configured: null, liveReady, testReady, rawStatus: res.status };
  } catch (error) {
    return { fnName, deployed: null, configured: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Billing doctor for: ${baseUrl}`);
  const results = await Promise.all(functionsToCheck.map((fn) => checkFunction(fn)));
  console.log("");
  let hasIssues = false;
  for (const result of results) {
    if (result.deployed === null) {
      hasIssues = true;
      console.log(`- ${result.fnName}: probe_failed (${result.error})`);
      continue;
    }
    if (!result.deployed) {
      hasIssues = true;
      console.log(`- ${result.fnName}: missing (deploy required)`);
      continue;
    }

    if (result.configured === false || result.valid === false) {
      hasIssues = true;
      console.log(`- ${result.fnName}: deployed, but live billing misconfigured`);
      for (const [key, ok] of Object.entries(result.configuredMap || {})) {
        console.log(`    - ${key}: ${fmt(Boolean(ok))}`);
      }
      for (const [key, ok] of Object.entries(result.validMap || {})) {
        console.log(`    - ${key}: ${fmt(Boolean(ok))}`);
      }
      continue;
    }

    if (result.configured === true || result.liveReady) {
      if (result.fnName === "stripe-webhook" && (result.pendingFailures || 0) > 0) {
        hasIssues = true;
        console.log(`- ${result.fnName}: live ready, but pending failures=${result.pendingFailures}`);
        console.log("    - run: npm run stripe:retry-webhooks");
        continue;
      }
      const testNote = result.testReady ? "live + test QA ready" : "live ready (test QA: npm run stripe:setup-test)";
      console.log(`- ${result.fnName}: ${testNote}`);
      if (result.fnName === "stripe-webhook" && result.lastProcessedAt) {
        console.log(`    - lastProcessedAt: ${result.lastProcessedAt}`);
      }
      if (result.fnName === "stripe-checkout" && result.marketBilling) {
        const mb = result.marketBilling;
        console.log(`    - marketBilling: uk=${mb.uk ? "ok" : "missing"} au=${mb.au ? "ok" : "missing"} pl=${mb.pl ? "ok" : "missing"}`);
      }
      continue;
    }

    hasIssues = true;
    console.log(
      `- ${result.fnName}: deployed, but diagnostics unavailable (HTTP ${result.rawStatus}; redeploy latest function code)`
    );
  }

  console.log("");
  if (hasIssues) {
    console.log("Billing doctor found issues. See README Stripe setup section.");
    printStripePriceGuide();
    process.exit(1);
  }
  console.log("Billing doctor passed.");
  printStripePriceGuide();
}

function printStripePriceGuide() {
  const plnOk = ["STARTER", "TEAM", "BUSINESS", "ENTERPRISE"].every((p) =>
    String(process.env[`STRIPE_PRICE_${p}_PLN`] || "").startsWith("price_")
  );
  const audOk = ["STARTER", "TEAM", "BUSINESS", "ENTERPRISE"].every((p) =>
    String(process.env[`STRIPE_PRICE_${p}_AUD`] || "").startsWith("price_")
  );

  console.log("\nStripe GBP monthly (billingPlans.js / seed script):");
  console.log("  Solo (starter)     £19  → STRIPE_PRICE_STARTER");
  console.log("  Team               £99  → STRIPE_PRICE_TEAM");
  console.log("  Business          £249  → STRIPE_PRICE_BUSINESS");
  console.log("  Enterprise        £499  → STRIPE_PRICE_ENTERPRISE");
  console.log("\nStripe AUD monthly (ex GST):");
  console.log("  Solo (starter)    A$59  → STRIPE_PRICE_STARTER_AUD");
  console.log("  Team             A$229  → STRIPE_PRICE_TEAM_AUD");
  console.log("  Business         A$579  → STRIPE_PRICE_BUSINESS_AUD");
  console.log("  Enterprise      A$1099  → STRIPE_PRICE_ENTERPRISE_AUD");
  console.log(`  Local .env.local: ${audOk ? "all four AUD ids set" : "AUD ids incomplete"}`);
  console.log("\nStripe PLN monthly (net):");
  console.log("  Solo (starter)     79 zł → STRIPE_PRICE_STARTER_PLN");
  console.log("  Team              399 zł → STRIPE_PRICE_TEAM_PLN");
  console.log("  Business          999 zł → STRIPE_PRICE_BUSINESS_PLN");
  console.log("  Enterprise       1899 zł → STRIPE_PRICE_ENTERPRISE_PLN");
  console.log(`  Local .env.local: ${plnOk ? "all four PLN ids set" : "PLN ids incomplete"}`);
  console.log("  Seed: npm run stripe:seed-prices  |  Sync secrets: npm run stripe:sync-secrets");
  console.log("  QA test mode: npm run stripe:setup-test  (STRIPE_SECRET_KEY_TEST in .env.local)");
  console.log("  Secrets live in Supabase Edge only (not Vercel).\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
