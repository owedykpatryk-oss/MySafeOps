/**
 * The management overview is a per-country document, so its dates and money must follow the
 * country workspace — not en-GB, which is what a hardcoded formatter gave every market.
 *
 * Deliberately runs in the default (node) environment: this is pure Intl formatting, and an
 * extra jsdom instance costs the shared test runner more than the coverage is worth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let locale = "en-GB";
let marketId = "uk";

vi.mock("../../utils/countryWorkspaces", () => ({
  getActiveDocumentLocale: () => locale,
}));

vi.mock("../../utils/orgMarket", () => ({
  getOrgMarketId: () => marketId,
}));

const { dateLabel, formatMoney, formatMonth, formatShortMonth } = await import("./format");

function useMarket(nextMarket, nextLocale) {
  marketId = nextMarket;
  locale = nextLocale;
}

beforeEach(() => useMarket("uk", "en-GB"));
afterEach(() => vi.restoreAllMocks());

describe("management overview formatting", () => {
  it("writes UK dates and pounds for a UK workspace", () => {
    expect(dateLabel("2026-08-03")).toBe("3 Aug");
    expect(formatMonth(new Date("2026-08-03T12:00:00"))).toBe("August 2026");
    expect(formatMoney(12000)).toBe("£12,000");
  });

  it("writes Polish dates and złoty for a Polish workspace", () => {
    useMarket("pl", "pl-PL");
    // Polish months are lower case and abbreviated differently — nothing like "3 Aug".
    expect(dateLabel("2026-08-03")).toMatch(/sie/);
    expect(formatMonth(new Date("2026-08-03T12:00:00"))).toMatch(/sierpie/);
    expect(formatShortMonth(new Date("2026-08-03T12:00:00"))).toMatch(/sie/);

    const money = formatMoney(12000);
    expect(money).toContain("zł");
    // Polish groups with a space, and the symbol trails the amount.
    expect(money).not.toContain("12,000");
    expect(money.trim().endsWith("zł")).toBe(true);
  });

  it("writes Australian dollars for an Australian workspace", () => {
    useMarket("au", "en-AU");
    const money = formatMoney(12000);
    expect(money).toContain("12,000");
    expect(money.startsWith("$") || money.startsWith("A$")).toBe(true);
    expect(money).not.toContain("£");
  });

  it("falls back to en-GB rather than throwing when no workspace locale is resolvable", () => {
    useMarket("uk", "");
    expect(dateLabel("2026-08-03")).toBe("3 Aug");
    expect(dateLabel("")).toBe("Not set");
  });
});
