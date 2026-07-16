import { describe, expect, it, vi, afterEach } from "vitest";

describe("superAdmin allowlist", () => {
  const prev = import.meta.env.VITE_PLATFORM_OWNER_EMAIL;

  afterEach(() => {
    import.meta.env.VITE_PLATFORM_OWNER_EMAIL = prev;
    vi.resetModules();
  });

  it("fails closed when VITE_PLATFORM_OWNER_EMAIL is unset", async () => {
    import.meta.env.VITE_PLATFORM_OWNER_EMAIL = "";
    vi.resetModules();
    const { isSuperAdminEmail } = await import("./superAdmin.js");
    expect(isSuperAdminEmail("mysafeops@gmail.com")).toBe(false);
    expect(isSuperAdminEmail("anyone@example.com")).toBe(false);
  });

  it("matches configured allowlist emails", async () => {
    import.meta.env.VITE_PLATFORM_OWNER_EMAIL = "owner@mysafeops.com, ops@mysafeops.com";
    vi.resetModules();
    const { isSuperAdminEmail, SUPERADMIN_EMAIL } = await import("./superAdmin.js");
    expect(isSuperAdminEmail("owner@mysafeops.com")).toBe(true);
    expect(isSuperAdminEmail("OPS@mysafeops.com")).toBe(true);
    expect(isSuperAdminEmail("other@example.com")).toBe(false);
    expect(SUPERADMIN_EMAIL).toBe("owner@mysafeops.com");
  });
});
