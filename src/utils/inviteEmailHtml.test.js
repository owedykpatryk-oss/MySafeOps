/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  buildOrgInviteEmailHtml,
  buildOrgInviteEmailSubject,
  buildOrgInviteEmailText,
  resolveEmailLogoUrl,
} from "../../supabase/functions/_shared/inviteEmailHtml.ts";

describe("inviteEmailHtml", () => {
  it("resolves relative logos against site URL and blocks data/http", () => {
    expect(resolveEmailLogoUrl("/branding/utility-mapping-logo.png", "https://mysafeops.com")).toBe(
      "https://mysafeops.com/branding/utility-mapping-logo.png"
    );
    expect(resolveEmailLogoUrl("https://cdn.example/logo.png", "https://mysafeops.com")).toBe(
      "https://cdn.example/logo.png"
    );
    expect(resolveEmailLogoUrl("http://insecure/logo.png", "https://mysafeops.com")).toBe("");
    expect(resolveEmailLogoUrl("data:image/png;base64,xxx", "https://mysafeops.com")).toBe("");
  });

  it("builds premium HTML with company + product logos and CTA", () => {
    const html = buildOrgInviteEmailHtml({
      orgName: "Utility Mapping",
      inviteeEmail: "damian@u-map.co.uk",
      acceptUrl: "https://mysafeops.com/accept-invite?invite=abc",
      supportEmail: "support@mysafeops.com",
      siteUrl: "https://mysafeops.com",
      companyLogoUrl: "https://mysafeops.com/branding/utility-mapping-logo.png",
      productLogoUrl: "https://mysafeops.com/branding/product-mark.png",
      primaryColor: "#0B1D3A",
      accentColor: "#00B4E4",
      website: "https://u-map.co.uk/",
      address: "6 Paynes Lane, Rugby",
      phone: "0800 024 UMAP",
      inviterName: "Patryk",
    });
    expect(html).toContain("Utility Mapping");
    expect(html).toContain("Accept invite");
    expect(html).toContain("Sending organisation");
    expect(html).toContain("utility-mapping-logo.png");
    expect(html).toContain("product-mark.png");
    expect(html).toContain("#0B1D3A");
    expect(html).toContain("Patryk");
    expect(html).toContain("damian@u-map.co.uk");
    expect(buildOrgInviteEmailSubject("Utility Mapping")).toMatch(/Utility Mapping/);
    expect(buildOrgInviteEmailText({
      orgName: "Utility Mapping",
      inviteeEmail: "a@b.com",
      acceptUrl: "https://x",
      supportEmail: "s@x.com",
      siteUrl: "https://mysafeops.com",
    })).toMatch(/Accept/i);
  });
});
