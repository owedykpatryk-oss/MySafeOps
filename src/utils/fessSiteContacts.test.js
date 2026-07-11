/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId, loadOrgScoped as load } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { seedFessSiteContacts } from "./fessSiteContacts";

describe("fessSiteContacts", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("seeds permit controller and hospital contacts per site", () => {
    const first = seedFessSiteContacts();
    expect(first.created).toBeGreaterThan(6);
    const contacts = load("emergency_contacts", []);
    expect(contacts.some((c) => String(c.label).includes("permit controller"))).toBe(true);
    expect(contacts.some((c) => String(c.label).includes("A&E"))).toBe(true);
    expect(seedFessSiteContacts().created).toBe(0);
  });

  it("does nothing for non-FESS org", () => {
    setOrgId("acme");
    expect(seedFessSiteContacts().created).toBe(0);
  });
});
