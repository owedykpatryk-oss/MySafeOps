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
    if (body?.configured && typeof body.configured === "object") {
      const configured = Object.values(body.configured).every(Boolean);
      const valid = body?.valid && typeof body.valid === "object" ? Object.values(body.valid).every(Boolean) : true;
      return {
        fnName,
        deployed: true,
        configured,
        valid,
        configuredMap: body.configured,
        validMap: body.valid || {},
        pendingFailures: Number.isFinite(body?.pendingFailures) ? Number(body.pendingFailures) : null,
        lastProcessedAt: body?.lastProcessedAt || null,
        rawStatus: res.status,
      };
    }
    return { fnName, deployed: true, configured: null, rawStatus: res.status };
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
      console.log(`- ${result.fnName}: deployed, but misconfigured`);
      for (const [key, ok] of Object.entries(result.configuredMap || {})) {
        console.log(`    - ${key}: ${fmt(Boolean(ok))}`);
      }
      for (const [key, ok] of Object.entries(result.validMap || {})) {
        console.log(`    - ${key}: ${fmt(Boolean(ok))}`);
      }
      continue;
    }

    if (result.configured === true) {
      if (result.fnName === "stripe-webhook" && (result.pendingFailures || 0) > 0) {
        hasIssues = true;
        console.log(`- ${result.fnName}: ready, but pending failures=${result.pendingFailures}`);
        console.log("    - run: npm run stripe:retry-webhooks");
        continue;
      }
      console.log(`- ${result.fnName}: ready`);
      if (result.fnName === "stripe-webhook" && result.lastProcessedAt) {
        console.log(`    - lastProcessedAt: ${result.lastProcessedAt}`);
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
    process.exit(1);
  }
  console.log("Billing doctor passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
