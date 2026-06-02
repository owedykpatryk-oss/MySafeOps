import { describe, expect, it } from "vitest";
import { isDisposableSignupEmail } from "./disposableEmail.js";

describe("isDisposableSignupEmail", () => {
  it("blocks known disposable domains", () => {
    expect(isDisposableSignupEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableSignupEmail("a@sub.mailinator.com")).toBe(true);
  });

  it("allows normal domains", () => {
    expect(isDisposableSignupEmail("user@gmail.com")).toBe(false);
    expect(isDisposableSignupEmail("")).toBe(false);
  });
});
