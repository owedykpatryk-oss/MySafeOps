import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { billingProjectRef, preflightBillingSecrets, syncBillingSecrets } from "../../scripts/lib/stripe-supabase-secrets.mjs";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

describe("Stripe secret synchronisation", () => {
  beforeEach(() => { vi.mocked(spawnSync).mockReset(); });
  it("requires an explicit valid Supabase project", () => {
    expect(billingProjectRef("https://example123.supabase.co/")).toBe("example123");
    expect(() => billingProjectRef("https://supabase.co.attacker.test")).toThrow();
  });
  it("stops on denied access before any secret write", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1, stderr: "403 forbidden" });
    expect(() => preflightBillingSecrets("project")).toThrow("403 forbidden");
    expect(spawnSync.mock.calls[0][1]).toContain("list");
    expect(spawnSync.mock.calls).toHaveLength(1);
  });
  it("keeps values out of command arguments and removes the temporary file", () => {
    let path;
    vi.mocked(spawnSync).mockImplementation((command, args, options) => {
      path = args.at(-1);
      expect(args.join(" ")).not.toContain("sk_live_fixture");
      expect(options.shell).toBe(false);
      expect(readFileSync(path, "utf8")).toContain('STRIPE_SECRET_KEY="sk_live_fixture"');
      return { status: 0 };
    });
    syncBillingSecrets("project", { STRIPE_SECRET_KEY: "sk_live_fixture" });
    expect(existsSync(path)).toBe(false);
  });
  it("redacts failures and cleans up even when the CLI fails", () => {
    let path;
    vi.mocked(spawnSync).mockImplementation((command, args) => {
      path = args.at(-1);
      return { status: 1, stderr: "rejected sk_live_fixture" };
    });
    expect(() => syncBillingSecrets("project", { STRIPE_SECRET_KEY: "sk_live_fixture" })).toThrow("rejected [REDACTED]");
    expect(existsSync(path)).toBe(false);
  });
});
