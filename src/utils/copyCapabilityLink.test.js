import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyCapabilityLink, SHARE_LINK_LOCAL_ONLY, SHARE_LINK_CLOUD } from "./copyCapabilityLink.js";

vi.mock("./copyToClipboard", () => ({
  copyTextToClipboard: vi.fn(),
}));

import { copyTextToClipboard } from "./copyToClipboard.js";

describe("copyCapabilityLink", () => {
  beforeEach(() => {
    vi.mocked(copyTextToClipboard).mockReset();
  });

  it("warns for local-only shares", async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(true);
    const pushToast = vi.fn();
    await copyCapabilityLink("https://example/x", { pushToast, localOnly: true });
    expect(pushToast).toHaveBeenCalledWith({ type: "warn", message: SHARE_LINK_LOCAL_ONLY });
  });

  it("success toast for cloud-published links", async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(true);
    const pushToast = vi.fn();
    await copyCapabilityLink("https://example/x", { pushToast, cloudPublished: true });
    expect(pushToast).toHaveBeenCalledWith({ type: "success", message: SHARE_LINK_CLOUD });
  });
});
