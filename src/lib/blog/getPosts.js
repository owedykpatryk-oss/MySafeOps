import {
  LANDING_BLOG_POSTS,
  getPostMetaBySlug,
  getRelatedBlogPosts,
  isValidBlogSlug,
} from "../../data/landingBlogPosts";
import { getActiveProjectSlug } from "../projects/config";
import { BLOG_POSTS_PER_PAGE } from "./constants";

/**
 * @typedef {import("../../data/landingBlogPosts").BlogPostMeta} BlogPostMeta
 * @typedef {{
 *   q?: string;
 *   category?: string;
 *   tag?: string;
 *   project?: string;
 *   page?: number;
 *   featuredOnly?: boolean;
 * }} BlogQuery
 */

/**
 * @param {BlogPostMeta} post
 * @param {string} q
 */
function matchesSearch(post, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [post.title, post.excerpt, ...(post.tags || []), post.category].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(needle);
}

/**
 * @param {BlogQuery} query
 */
export function queryBlogPosts(query = {}) {
  const project = query.project || getActiveProjectSlug();
  const q = String(query.q || "").trim().toLowerCase();
  const category = String(query.category || "").trim();
  const tag = String(query.tag || "").trim().toLowerCase();
  const featuredOnly = Boolean(query.featuredOnly);

  let posts = LANDING_BLOG_POSTS.filter((p) => (p.project || "mysafeops") === project);

  if (category) posts = posts.filter((p) => p.category === category);
  if (tag) posts = posts.filter((p) => (p.tags || []).some((t) => t.toLowerCase() === tag));
  if (featuredOnly) posts = posts.filter((p) => p.featured);
  if (q) posts = posts.filter((p) => matchesSearch(p, q));

  posts = [...posts].sort((a, b) => {
    const d = String(b.publishedIso || "").localeCompare(String(a.publishedIso || ""));
    if (d !== 0) return d;
    return a.slug.localeCompare(b.slug);
  });

  return posts;
}

/**
 * @param {BlogQuery} query
 */
export function paginateBlogPosts(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const all = queryBlogPosts(query);
  const totalPages = Math.max(1, Math.ceil(all.length / BLOG_POSTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * BLOG_POSTS_PER_PAGE;
  const items = all.slice(start, start + BLOG_POSTS_PER_PAGE);

  return {
    items,
    page: safePage,
    totalPages,
    totalCount: all.length,
    perPage: BLOG_POSTS_PER_PAGE,
  };
}

/** @param {string} [project] */
export function getAllBlogTags(project) {
  const posts = queryBlogPosts({ project });
  const set = new Set();
  for (const p of posts) {
    for (const t of p.tags || []) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** @param {string} [project] */
export function getRecentBlogPosts(limit = 5, project) {
  return queryBlogPosts({ project }).slice(0, limit);
}

export { getPostMetaBySlug, getRelatedBlogPosts, isValidBlogSlug, LANDING_BLOG_POSTS };
