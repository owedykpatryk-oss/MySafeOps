import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(args, redactions = []) {
  const result = spawnSync(process.platform === "win32" ? "supabase.exe" : "supabase", args, {
    encoding: "utf8", shell: false, timeout: 60000,
  });
  if (result.error || result.status !== 0) {
    let message = result.error?.message || result.stderr || "Supabase CLI failed";
    for (const value of redactions) message = message.split(value).join("[REDACTED]");
    throw new Error(message.trim());
  }
}

export function billingProjectRef(url) {
  const match = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url || "");
  if (!match) throw new Error("VITE_SUPABASE_URL must identify the intended Supabase project");
  return match[1];
}

export function preflightBillingSecrets(projectRef) {
  run(["secrets", "list", "--project-ref", projectRef, "--output", "json"]);
}

/** Values never appear in command arguments or logs; the temporary file is always removed. */
export function syncBillingSecrets(projectRef, secrets) {
  for (const [key, value] of Object.entries(secrets)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || !value || /[\r\n]/.test(value)) {
      throw new Error(`Invalid secret value for ${key}`);
    }
  }
  const directory = mkdtempSync(join(tmpdir(), "mysafeops-billing-"));
  const path = join(directory, "secrets.env");
  try {
    writeFileSync(path, Object.entries(secrets).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n"), { mode: 0o600 });
    run(["secrets", "set", "--project-ref", projectRef, "--env-file", path], Object.values(secrets));
  } finally {
    try { unlinkSync(path); } finally { rmdirSync(directory); }
  }
}
