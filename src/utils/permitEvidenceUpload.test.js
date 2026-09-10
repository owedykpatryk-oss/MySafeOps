import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn(async () => ({ error: null }));
const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://example.test/signed" } }));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      })),
    },
    storage: {
      from: vi.fn(() => ({ upload, createSignedUrl })),
    },
  },
}));

vi.mock("./countryWorkspaces", () => ({
  getCachedActiveCountryWorkspace: vi.fn(),
}));

import { getCachedActiveCountryWorkspace } from "./countryWorkspaces";
import { uploadPermitEvidencePhoto } from "./permitEvidenceUpload";

describe("permitEvidenceUpload workspace path", () => {
  beforeEach(() => {
    upload.mockClear();
    createSignedUrl.mockClear();
    vi.mocked(getCachedActiveCountryWorkspace).mockReset();
  });

  it("uses the active country workspace segment in the storage path", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue({
      id: "11111111-1111-4111-8111-111111111111",
      market_id: "uk",
    });
    const file = new File(["x"], "site.jpg", { type: "image/jpeg" });

    const result = await uploadPermitEvidencePhoto(file, "permit-42");

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(
        /^user-1\/11111111-1111-4111-8111-111111111111\/permit-42\/\d+\.jpg$/,
      ),
      file,
      expect.objectContaining({ upsert: false }),
    );
    expect(result.path).toMatch(
      /^user-1\/11111111-1111-4111-8111-111111111111\/permit-42\/\d+\.jpg$/,
    );
    expect(result.signedUrl).toBe("https://example.test/signed");
  });

  it("falls back to a legacy segment when no country workspace is cached", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue(null);
    const file = new File(["x"], "site.png", { type: "image/png" });

    const result = await uploadPermitEvidencePhoto(file, "permit-99");

    expect(result.path).toMatch(/^user-1\/legacy\/permit-99\/\d+\.png$/);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/legacy\/permit-99\/\d+\.png$/),
      file,
      expect.any(Object),
    );
  });
});
