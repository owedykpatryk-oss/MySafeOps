import { describe, expect, it, vi } from "vitest";
import { trackBlogArticleView, trackBlogIndexView, trackEvent } from "./analytics";

describe("analytics", () => {
  it("calls gtag and plausible when present", () => {
    const gtag = vi.fn();
    const plausible = vi.fn();
    globalThis.window = { gtag, plausible };

    trackEvent("test_event", { k: "v" });

    expect(gtag).toHaveBeenCalledWith("event", "test_event", { k: "v" });
    expect(plausible).toHaveBeenCalledWith("test_event", { props: { k: "v" } });

    delete globalThis.window;
  });

  it("exposes blog helpers without throwing", () => {
    globalThis.window = {};
    expect(() => trackBlogIndexView()).not.toThrow();
    expect(() => trackBlogArticleView("permit-to-work-app-uk")).not.toThrow();
    delete globalThis.window;
  });
});
