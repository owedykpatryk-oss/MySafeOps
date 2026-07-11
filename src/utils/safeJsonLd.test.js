import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./safeJsonLd.js";

describe("serializeJsonLd", () => {
  it("escapes closing script sequences inside JSON strings", () => {
    const raw = serializeJsonLd({ name: "bad</script><script>alert(1)" });
    expect(raw).not.toContain("</script>");
    expect(raw).toContain("\\u003c/script");
  });

  it("round-trips normal blog schema objects", () => {
    const graph = { "@context": "https://schema.org", "@type": "BlogPosting", headline: "RAMS UK" };
    expect(JSON.parse(serializeJsonLd(graph))).toEqual(graph);
  });
});
