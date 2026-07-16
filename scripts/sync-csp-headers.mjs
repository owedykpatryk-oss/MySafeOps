#!/usr/bin/env node
/**
 * Write canonical CSP from src/config/contentSecurityPolicy.js into vercel.json and public/_headers.
 * Usage: npm run csp:sync
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_SECURITY_POLICY } from "../src/config/contentSecurityPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function syncVercelJson() {
  const path = resolve(root, "vercel.json");
  const vercel = JSON.parse(readFileSync(path, "utf8"));
  let updated = 0;
  for (const block of vercel.headers || []) {
    for (const header of block.headers || []) {
      if (header.key === "Content-Security-Policy") {
        header.value = CONTENT_SECURITY_POLICY;
        updated += 1;
      }
    }
  }
  if (!updated) throw new Error("vercel.json: no Content-Security-Policy header found");
  writeFileSync(path, `${JSON.stringify(vercel, null, 2)}\n`, "utf8");
  console.log(`✓ vercel.json — ${updated} CSP header(s) updated`);
}

function syncPublicHeaders() {
  const path = resolve(root, "public/_headers");
  const raw = readFileSync(path, "utf8");
  const re = /^(\s*Content-Security-Policy:\s*).+$/m;
  if (!re.test(raw)) throw new Error("public/_headers: Content-Security-Policy line not found");
  const next = raw.replace(re, `$1${CONTENT_SECURITY_POLICY}`);
  if (next === raw) {
    console.log("✓ public/_headers — CSP already up to date");
    return;
  }
  writeFileSync(path, next, "utf8");
  console.log("✓ public/_headers — CSP updated");
}

console.log("Syncing Content-Security-Policy…\n");
syncVercelJson();
syncPublicHeaders();
console.log("\nDone. Run npm run security:doctor to verify.");
