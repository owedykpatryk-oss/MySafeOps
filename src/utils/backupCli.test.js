import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { backupKeyScope } from "./backupValidation.js";

it("CLI dry run routes primary and country keys and rejects a foreign target", () => {
  const dir = mkdtempSync(join(tmpdir(), "mysafeops-backup-cli-"));
  try {
    const keys = { rams_builder_docs_acme: "[]", "rams_builder_docs_acme__country_pl-id": "[]" };
    const bundle = { version: 2, orgId: "acme", keys, scopes: Object.fromEntries(Object.keys(keys).map(key => [key, backupKeyScope(key, "acme")])) };
    const file = join(dir, "backup.json");
    writeFileSync(file, JSON.stringify(bundle));
    const run = (orgId) => spawnSync(process.execPath, [resolve("scripts/d1-import-backup.mjs"), "--file", file, "--dry-run"], {
      encoding: "utf8", env: { ...process.env, VITE_D1_API_URL: "http://127.0.0.1:1", D1_IMPORT_JWT: "synthetic-dry-run", D1_IMPORT_ORG_SLUG: orgId },
    });
    const valid = run("acme");
    expect(valid.status, valid.stderr).toBe(0);
    expect(valid.stdout).toContain("rams_builder_docs / main");
    expect(valid.stdout).toContain("rams_builder_docs / country:pl-id:main");
    expect(run("other").status).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 30000);
