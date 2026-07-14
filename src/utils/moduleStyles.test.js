import { describe, expect, it } from "vitest";
import { ms } from "./moduleStyles.js";

describe("moduleStyles (ms)", () => {
  it("is a style object, not a factory function", () => {
    expect(typeof ms).toBe("object");
    expect(ms).not.toBeNull();
    expect(() => ms()).toThrow(TypeError);
  });

  it("exposes shared tokens used by settings and dialogs", () => {
    expect(ms.btn).toBeTruthy();
    expect(ms.inp).toBeTruthy();
    expect(ms.ta?.resize).toBe("vertical");
    expect(ms.btnO?.background).toBe("#f97316");
  });
});
