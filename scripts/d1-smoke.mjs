#!/usr/bin/env node
/**
 * GET {VITE_D1_API_URL}/v1/health — no auth; verifies Worker is reachable.
 * Uses .env.local when present; override with: VITE_D1_API_URL=... node scripts/d1-smoke.mjs
 */
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");

if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}

const base = String(process.env.VITE_D1_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
if (!base) {
  console.error("d1:smoke — VITE_D1_API_URL is empty. Set in .env.local or export it.\n");
  process.exit(1);
}

const url = `${base}/v1/health`;
try {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error(`d1:smoke — ${res.status} ${url}\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}\n`);
    process.exit(1);
  }
  const rid = res.headers.get("x-request-id") || res.headers.get("X-Request-Id") || "";
  const refPol = res.headers.get("referrer-policy") || res.headers.get("Referrer-Policy") || "";
  const nosniff = res.headers.get("x-content-type-options") || res.headers.get("X-Content-Type-Options") || "";
  console.log(`d1:smoke — OK ${res.status} ${url}`);
  if (rid) console.log(`X-Request-Id: ${rid}`);
  if (!refPol || !/strict-origin-when-cross-origin/i.test(refPol)) {
    console.warn("d1:smoke — WARNING: missing or unexpected Referrer-Policy (expected strict-origin-when-cross-origin)");
  } else {
    console.log(`Referrer-Policy: ${refPol}`);
  }
  if (!nosniff || !/nosniff/i.test(nosniff)) {
    console.warn("d1:smoke — WARNING: missing X-Content-Type-Options: nosniff");
  } else {
    console.log(`X-Content-Type-Options: ${nosniff}`);
  }
  console.log(JSON.stringify(body, null, 2));
} catch (e) {
  console.error(`d1:smoke — ${e?.message || e}\n`);
  process.exit(1);
}
