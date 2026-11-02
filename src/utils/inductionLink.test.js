import { expect, it } from "vitest";
import { buildInductionLink } from "./inductionLink";

it("opens the induction route with encoded identifiers", () => {
  const url = new URL(buildInductionLink("https://mysafeops.com/app", "site & 1", "acme"));
  expect(url.pathname).toBe("/app");
  expect(url.searchParams.get("view")).toBe("induction");
  expect(url.searchParams.get("site")).toBe("site & 1");
  expect(url.searchParams.get("org")).toBe("acme");
});
