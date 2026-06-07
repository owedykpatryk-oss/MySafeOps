import { useEffect } from "react";
import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import BlogPromoStrip from "../components/blog/BlogPromoStrip";
import BlogArticleCard from "../components/blog/BlogArticleCard";
import BlogCategoryFilter from "../components/blog/BlogCategoryFilter";
import BlogLayout from "../components/blog/BlogLayout";
import BlogPagination from "../components/blog/BlogPagination";
import BlogRecentPosts from "../components/blog/BlogRecentPosts";
import BlogSearch from "../components/blog/BlogSearch";
import BlogTagFilter from "../components/blog/BlogTagFilter";
import { getAllBlogTags } from "../lib/blog/getPosts";
import { createSeoMeta } from "../lib/seo/createSeoMeta";
import { generateCanonical, getPublicSiteOrigin } from "../lib/seo/generateCanonical";
import { useBlogDocumentMeta } from "../lib/seo/useBlogDocumentMeta";
import { getProjectConfig } from "../lib/projects/config";
import { useBlogFilters } from "../hooks/blog/useBlogFilters";
import { trackBlogIndexView } from "../utils/analytics";
import { getSupportEmail } from "../config/supportContact";
import { LANDING_BLOG_POSTS } from "../data/landingBlogPosts";
import "../styles/landing.css";

const SUPPORT_EMAIL = getSupportEmail();

export default function BlogIndexPage() {
  const origin = getPublicSiteOrigin();
  const project = getProjectConfig();
  const { q, category, tag, page, totalPages, totalCount, posts, setFilter, clearFilters } =
    useBlogFilters();
  const allTags = getAllBlogTags();

  const defaultOgImage = LANDING_BLOG_POSTS[0]?.image;
  const seo = createSeoMeta({
    title: project.blogTitle,
    description: project.blogDescription,
    canonicalUrl: generateCanonical("/blog"),
    ogImageUrl: defaultOgImage ? `${origin}${defaultOgImage}` : undefined,
    rssFeedUrl: `${origin}/blog/rss.xml`,
  });

  useBlogDocumentMeta({
    title: seo.title,
    description: seo.description,
    canonicalUrl: seo.canonicalUrl,
    ogType: "website",
    ogImageUrl: seo.ogImageUrl,
    rssFeedUrl: seo.rssFeedUrl,
    siteName: seo.siteName,
    locale: seo.locale,
  });

  useEffect(() => {
    trackBlogIndexView();
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("blog-smooth-scroll");
    return () => document.documentElement.classList.remove("blog-smooth-scroll");
  }, []);

  const hasFilters = Boolean(q || category || tag);

  return (
    <BlogLayout navCurrent="blog">
      <div className="blog-index-page blog-index-page--enhanced">
        <section className="landing-blog-section landing-blog-section--page" aria-labelledby="blog-index-heading">
          <div className="ctn">
            <nav className="blog-breadcrumb" aria-label="Breadcrumb">
              <ol className="blog-breadcrumb-list">
                <li className="blog-breadcrumb-item">
                  <Link to="/">Home</Link>
                </li>
                <li className="blog-breadcrumb-item blog-breadcrumb-item--current" aria-current="page">
                  Blog
                </li>
              </ol>
            </nav>
            <div className="sh landing-blog-intro">
              <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
                UK construction
              </div>
              <h1 id="blog-index-heading">Safety guides &amp; compliance notes</h1>
              <p className="landing-blog-lead">
                Practical articles for site managers and H&amp;S leads. Search, filter by topic, or browse all guides.
              </p>
              <p className="landing-blog-rss-note">
                <a href="/blog/rss.xml" className="landing-blog-index-link">
                  RSS feed
                </a>{" "}
                ·{" "}
                <a href="/sitemap.xml" className="landing-blog-index-link">
                  Sitemap
                </a>
              </p>
            </div>

            <BlogPromoStrip />

            <div className="blog-index-toolbar">
              <BlogSearch
                value={q}
                onChange={(v) => setFilter({ q: v })}
                resultCount={totalCount}
              />
              <BlogCategoryFilter active={category} onChange={(v) => setFilter({ category: v })} />
              <BlogTagFilter tags={allTags} active={tag} onChange={(v) => setFilter({ tag: v })} />
              {hasFilters ? (
                <button type="button" className="blog-clear-filters" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="blog-index-layout">
              <div className="blog-index-main">
                {posts.length === 0 ? (
                  <p className="blog-empty-state">No articles match your filters.</p>
                ) : (
                  <ul className="landing-blog-grid landing-blog-grid--page blog-posts-list">
                    {posts.map((post, index) => (
                      <BlogArticleCard key={post.slug} post={post} index={index} />
                    ))}
                  </ul>
                )}
                <BlogPagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(p) => setFilter({ page: String(p) })}
                />
              </div>
              <BlogRecentPosts />
            </div>
          </div>
        </section>
      </div>
      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </BlogLayout>
  );
}
