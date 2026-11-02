import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/d1SyncClient.js", () => ({
  isD1Configured: vi.fn(),
  d1PutKv: vi.fn(),
}));

import { pushBackupBundleToD1 } from "./d1BackupPush.js";
import * as d1Client from "../lib/d1SyncClient.js";

describe("pushBackupBundleToD1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(d1Client.isD1Configured).mockReturnValue(true);
    vi.mocked(d1Client.d1PutKv).mockResolvedValue({ ok: true, version: 1 });
  });

  it("returns error when D1 is not configured", async () => {
    vi.mocked(d1Client.isD1Configured).mockReturnValue(false);
    const r = await pushBackupBundleToD1(
      {},
      { version: 1, orgId: "acme", keys: { "waste_register_acme": "[]" } },
      { orgSlug: "acme" }
    );
    expect(r.ok).toBe(false);
    expect(r.pushed).toBe(0);
    expect(r.errors[0].error).toBe("d1_not_configured");
    expect(d1Client.d1PutKv).not.toHaveBeenCalled();
  });

  it("returns error for invalid bundle", async () => {
    const r = await pushBackupBundleToD1({}, { keys: {} }, { orgSlug: "acme" });
    expect(r.ok).toBe(false);
    expect(r.pushed).toBe(0);
    expect(r.errors[0].error).toMatch(/backup/i);
  });

  it("returns error when org slug is missing or default", async () => {
    const bundle = { version: 1, orgId: "acme", keys: { "waste_register_acme": "[]" } };
    let r = await pushBackupBundleToD1({}, bundle, { orgSlug: "" });
    expect(r.ok).toBe(false);
    expect(r.errors[0].error).toBe("no_org_slug");
    r = await pushBackupBundleToD1({}, bundle, { orgSlug: "default" });
    expect(r.ok).toBe(false);
    expect(d1Client.d1PutKv).not.toHaveBeenCalled();
  });

  it("pushes only known namespaces with matching org suffix and array JSON", async () => {
    const bundle = {
      version: 1, orgId: "acme",
      keys: {
        "waste_register_acme": '[{"id":"a"}]',
        "document_templates_acme": "[]",
        "waste_register_acme__country_pl-id": "[]",
        "permits_v2_acme": "{}",
      },
    };
    const r = await pushBackupBundleToD1({}, bundle, { orgSlug: "acme" });
    expect(r.ok).toBe(true);
    expect(r.pushed).toBe(2);
    expect(d1Client.d1PutKv).toHaveBeenCalledTimes(2);
    expect(d1Client.d1PutKv).toHaveBeenCalledWith({}, "acme", "waste_register", "main", [{ id: "a" }], undefined);
    expect(d1Client.d1PutKv).toHaveBeenCalledWith({}, "acme", "waste_register", "country:pl-id:main", [], undefined);
  });

  it("collects errors when a PUT fails", async () => {
    vi.mocked(d1Client.d1PutKv).mockResolvedValueOnce({ ok: false, error: "http_403" });
    const bundle = {
      version: 1, orgId: "acme",
      keys: {
        "waste_register_acme": "[]",
      },
    };
    const r = await pushBackupBundleToD1({}, bundle, { orgSlug: "acme" });
    expect(r.ok).toBe(false);
    expect(r.pushed).toBe(0);
    expect(r.errors).toEqual([{ namespace: "waste_register", error: "http_403" }]);
  });

  it("rejects mismatched ownership before sending any registers", async () => {
    for (const bundle of [
      { version: 1, orgId: "other", keys: { waste_register_acme: "[]" } },
      { version: 1, orgId: "acme", keys: { waste_register_acme: "[]", waste_register_other: "[]" } },
      { version: 1, orgId: "acme", keys: { waste_register_other_acme: "[]" } },
    ]) {
      expect((await pushBackupBundleToD1({}, bundle, { orgSlug: "acme" })).ok).toBe(false);
    }
    expect(d1Client.d1PutKv).not.toHaveBeenCalled();
  });
});
