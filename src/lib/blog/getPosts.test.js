import { describe, expect, it } from "vitest";
import { paginateBlogPosts, queryBlogPosts } from "./getPosts.js";
import { generateSlug } from "../content-generator/index.js";
import { createInternalLinks } from "../seo/createInternalLinks.js";

describe("queryBlogPosts", () => {
  it("filters by category", () => {
    const posts = queryBlogPosts({ category: "permits" });
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.category === "permits")).toBe(true);
  });

  it("searches title and tags", () => {
    const posts = queryBlogPosts({ q: "rams" });
    expect(posts.some((p) => p.slug.includes("rams"))).toBe(true);
  });
});

describe("paginateBlogPosts", () => {
  it("returns stable pages", () => {
    const page1 = paginateBlogPosts({ page: 1 });
    const page2 = paginateBlogPosts({ page: 2 });
    expect(page1.items.length).toBeGreaterThan(0);
    expect(page1.page).toBe(1);
    if (page1.totalPages > 1) {
      expect(page2.page).toBe(2);
      expect(page1.items[0].slug).not.toBe(page2.items[0]?.slug);
    }
  });
});

describe("generateSlug", () => {
  it("normalizes titles", () => {
    expect(generateSlug("Hot Work Permit UK: Guide!")).toBe("hot-work-permit-uk-guide");
  });
});

describe("createInternalLinks", () => {
  it("suggests same-category posts", () => {
    const links = createInternalLinks({
      slug: "hot-work-permit-uk",
      category: "permits",
      tags: ["hot-work"],
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.slug !== "hot-work-permit-uk")).toBe(true);
  });
});
