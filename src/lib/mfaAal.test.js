import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRequiresMfaStep } from "./mfaAal.js";

describe("getRequiresMfaStep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns needsMfa when next is aal2 and current is not", async () => {
    const client = {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: "aal1", nextLevel: "aal2" },
            error: null,
          }),
        },
      },
    };
    await expect(getRequiresMfaStep(client)).resolves.toEqual({ needsMfa: true });
  });

  it("fails closed with probeFailed on API error", async () => {
    const client = {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "network" },
          }),
        },
      },
    };
    const out = await getRequiresMfaStep(client);
    expect(out.probeFailed).toBe(true);
    expect(out.needsMfa).toBe(false);
    expect(out.error).toMatch(/network/);
  });

  it("fails closed when getAuthenticatorAssuranceLevel throws", async () => {
    const client = {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockRejectedValue(new Error("boom")),
        },
      },
    };
    const out = await getRequiresMfaStep(client);
    expect(out.probeFailed).toBe(true);
    expect(out.error).toMatch(/boom/);
  });
});
