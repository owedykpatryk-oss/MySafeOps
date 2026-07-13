import { describe, expect, it } from "vitest";
import { getMarketIdFromSearchParams, resolvePreferredMarketId } from "./marketPref";

describe("marketPref", () => {
  it("reads market from query string", () => {
    expect(getMarketIdFromSearchParams("?market=au")).toBe("au");
    expect(getMarketIdFromSearchParams("?market=uk")).toBe("uk");
    expect(getMarketIdFromSearchParams("?market=pl")).toBe("pl");
    expect(getMarketIdFromSearchParams("?email=a@b.com")).toBeNull();
  });

  it("prefers URL over default", () => {
    expect(resolvePreferredMarketId("?market=au")).toBe("au");
    expect(resolvePreferredMarketId("?market=pl")).toBe("pl");
    expect(resolvePreferredMarketId("")).toBe("uk");
  });
});
