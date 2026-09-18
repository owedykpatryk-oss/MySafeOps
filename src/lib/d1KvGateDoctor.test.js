import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Regression guard for scripts/security-doctor.mjs D1 KV write/delete needles. */
const d1ApiPath = resolve(process.cwd(), "cloudflare/workers/d1-api/index.mjs");
const d1Api = readFileSync(d1ApiPath, "utf8");
const headerEnd = d1Api.indexOf("*/");
const header = headerEnd >= 0 ? d1Api.slice(0, headerEnd + 2) : "";
const body = headerEnd >= 0 ? d1Api.slice(headerEnd + 2) : d1Api;

function hasWriteGate(src) {
  return (
    src.includes("/rpc/user_can_write_org_country_kv") ||
    src.includes("/rpc/user_can_write_org_kv")
  );
}

function hasDeleteGate(src) {
  return (
    src.includes("/rpc/user_can_delete_org_country_kv") ||
    src.includes("/rpc/user_can_delete_org_kv")
  );
}

describe("D1 KV permission RPC gates (security-doctor contract)", () => {
  it("calls write gate via /rpc/ path", () => {
    expect(hasWriteGate(d1Api)).toBe(true);
    expect(d1Api).toMatch(/\/rest\/v1\/rpc\/user_can_write_org_(country_)?kv/);
  });

  it("calls delete gate via /rpc/ path", () => {
    expect(hasDeleteGate(d1Api)).toBe(true);
    expect(d1Api).toMatch(/\/rest\/v1\/rpc\/user_can_delete_org_(country_)?kv/);
  });

  it("does not satisfy write/delete gates from the file header alone", () => {
    expect(hasWriteGate(header)).toBe(false);
    expect(hasDeleteGate(header)).toBe(false);
    expect(hasWriteGate(body)).toBe(true);
    expect(hasDeleteGate(body)).toBe(true);
  });
});
