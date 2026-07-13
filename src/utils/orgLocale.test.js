import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./orgStorage", () => ({
  getOrgId: () => "org_test",
}));

vi.mock("./orgMarket", () => ({
  getOrgMarketId: vi.fn(() => "uk"),
}));

vi.mock("./orgSettingsStorage", () => ({
  loadOrgSettingsRaw: vi.fn(() => ({})),
}));

import { getOrgMarketId } from "./orgMarket";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { formatOrgDate, getOrgLocale } from "./orgLocale";

describe("orgLocale", () => {
  beforeEach(() => {
    vi.mocked(loadOrgSettingsRaw).mockReturnValue({});
    vi.mocked(getOrgMarketId).mockReturnValue("uk");
  });

  it("uses org settings locale when set", () => {
    vi.mocked(loadOrgSettingsRaw).mockReturnValue({ locale: "pl-PL" });
    expect(getOrgLocale()).toBe("pl-PL");
  });

  it("falls back to market locale for AU orgs", () => {
    vi.mocked(getOrgMarketId).mockReturnValue("au");
    expect(getOrgLocale()).toBe("en-AU");
  });

  it("formats dates with AU locale", () => {
    vi.mocked(getOrgMarketId).mockReturnValue("au");
    const label = formatOrgDate("2026-07-12T12:00:00.000Z");
    expect(label).toMatch(/12/);
    expect(label).toMatch(/2026/);
  });
});
