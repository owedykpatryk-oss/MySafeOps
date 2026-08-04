import { describe, expect, it } from "vitest";
import {
  getAlternateMarkets,
  getMarket,
  MARKETS,
  MARKET_IDS,
  isValidMarketId,
  resolveMarketId,
} from "./markets";

describe("markets", () => {
  it("resolves uk by default", () => {
    expect(resolveMarketId(undefined)).toBe("uk");
    expect(resolveMarketId("au")).toBe("au");
  });

  it("exposes AU landing and legal paths", () => {
    const au = getMarket("au");
    expect(au.homePath).toBe("/au");
    expect(au.currency).toBe("AUD");
    expect(au.privacyPath).toBe("/au/privacy");
    expect(au.legalBasePath).toBe("/legal/au");
  });

  it("exposes PL landing and legal paths", () => {
    const pl = getMarket("pl");
    expect(pl.homePath).toBe("/pl");
    expect(pl.currency).toBe("PLN");
    expect(pl.locale).toBe("pl-PL");
    expect(pl.legalBasePath).toBe("/legal/pl");
  });

  it("getAlternateMarkets returns a complete reciprocal cluster (not just alternateMarketId)", () => {
    expect(getAlternateMarkets("uk").map((m) => m.id).sort()).toEqual(["au", "pl"]);
    expect(getAlternateMarkets("au").map((m) => m.id).sort()).toEqual(["pl", "uk"]);
    expect(getAlternateMarkets("pl").map((m) => m.id).sort()).toEqual(["au", "uk"]);
    expect(getMarket("uk").alternateMarketId).toBe("au");
    expect(MARKET_IDS).toEqual(["uk", "au", "pl"]);
    expect(Object.keys(MARKETS)).toEqual(MARKET_IDS);
  });

  it("validates market ids via registry", () => {
    expect(isValidMarketId("au")).toBe(true);
    expect(isValidMarketId("ie")).toBe(false);
    expect(resolveMarketId("ie")).toBe("uk");
  });
});
