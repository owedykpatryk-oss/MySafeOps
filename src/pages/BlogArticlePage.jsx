import { useEffect, useMemo, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { getBundledPostMarkdown } from "../blog/loadPostMarkdown";
import LandingFooter from "../components/landing/LandingFooter";
import BlogAppCta from "../components/blog/BlogAppCta";
import BlogArticleToc from "../components/blog/BlogArticleToc";
import BlogLayout from "../components/blog/BlogLayout";
import BlogRelatedPosts from "../components/blog/BlogRelatedPosts";
import BlogShareButtons from "../components/blog/BlogShareButtons";
import { getCategoryBySlug } from "../lib/blog/categories";
import { getPostMetaBySlug, isValidBlogSlug } from "../lib/blog/getPosts";
import { createSeoMeta } from "../lib/seo/createSeoMeta";
import { createSchemaGraph } from "../lib/seo/createSchema";
import { getBlogPostUrl, getPublicSiteOrigin } from "../lib/seo/generateCanonical";
import { useBlogDocumentMeta, useBlogJsonLdScripts } from "../lib/seo/useBlogDocumentMeta";
import { trackBlogArticleView } from "../utils/analytics";
import {
  addExternalLinkAttributes,
  addLazyLoadingToBlogImages,
  parseBlogPostHtml,
} from "../utils/blogMarkdownRender";
import "../styles/landing.css";
import { getSupportEmail } from "../config/supportContact";

const SUPPORT_EMAIL = getSupportEmail();

const BLOG_HTML_SANITIZE = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["form", "iframe", "object", "embed", "base", "link", "meta", "style", "input", "textarea", "button", "select"],
};

/** @param {string | undefined} isoDate `YYYY-MM-DD` */
function toOgArticleTime(isoDate) {
  if (!isoDate) return undefined;
  return `${isoDate}T12:00:00.000Z`;
}

function useBlogArticleLinkDelegate(articleRef, html) {
  const navigate = useNavigate();

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return undefined;

    const onClick = (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) return;
      let url;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/blog/")) return;
      if (url.pathname === "/blog") return;
      e.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [articleRef, html, navigate]);
}

export default function BlogArticlePage() {
  const { slug } = useParams();
  const articleRef = useRef(null);

  const meta = slug ? getPostMetaBySlug(slug) : null;

  const { html, toc, loadError } = useMemo(() => {
    if (!slug || !isValidBlogSlug(slug)) {
      return { html: "", toc: [], loadError: null };
    }
    const raw = getBundledPostMarkdown(slug);
    if (!raw) {
      return { html: "", toc: [], loadError: "missing" };
    }
    try {
      const { html: rawHtml, toc: headings } = parseBlogPostHtml(raw);
      const safe = DOMPurify.sanitize(rawHtml, BLOG_HTML_SANITIZE);
      const withLinks = addExternalLinkAttributes(safe);
      const withLazyImages = addLazyLoadingToBlogImages(withLinks);
      return { html: withLazyImages, toc: headings, loadError: null };
    } catch {
      return { html: "", toc: [], loadError: "parse" };
    }
  }, [slug]);

  useBlogArticleLinkDelegate(articleRef, html);

  const origin = getPublicSiteOrigin();
  const metaForHead = meta && slug && !loadError ? meta : null;
  const canonicalUrl = metaForHead && slug ? getBlogPostUrl(slug) : "";
  const articleOgTime = metaForHead ? toOgArticleTime(metaForHead.publishedIso) : undefined;

  const seo = metaForHead
    ? createSeoMeta({
        title: `${metaForHead.title} · MySafeOps`,
        description: metaForHead.excerpt,
        canonicalUrl,
        ogImageUrl: metaForHead.image ? `${origin}${metaForHead.image}` : undefined,
        ogType: "article",
        rssFeedUrl: `${origin}/blog/rss.xml`,
        articlePublishedTime: articleOgTime,
        articleModifiedTime: articleOgTime,
      })
    : null;

  useBlogDocumentMeta(
    {
      title: seo?.title ?? "",
      description: seo?.description ?? "",
      canonicalUrl: seo?.canonicalUrl ?? "",
      ogImageUrl: seo?.ogImageUrl,
      ogType: "article",
      rssFeedUrl: seo?.rssFeedUrl,
      articlePublishedTime: seo?.articlePublishedTime,
      articleModifiedTime: seo?.articleModifiedTime,
      siteName: seo?.siteName,
      locale: seo?.locale,
    },
    Boolean(metaForHead),
  );

  useEffect(() => {
    if (slug && metaForHead) trackBlogArticleView(slug);
  }, [slug, metaForHead]);

  const jsonLdGraphs = useMemo(() => {
    if (!metaForHead || !slug || loadError) return null;
    return createSchemaGraph(metaForHead, slug, origin);
  }, [metaForHead, slug, loadError, origin]);

  useBlogJsonLdScripts(jsonLdGraphs, Boolean(jsonLdGraphs?.length));

  useEffect(() => {
    document.documentElement.classList.add("blog-smooth-scroll");
    return () => document.documentElement.classList.remove("blog-smooth-scroll");
  }, []);

  useEffect(() => {
    if (!slug || loadError) return undefined;
    const el = document.getElementById("blog-article-main");
    if (el) el.focus({ preventScroll: true });
    return undefined;
  }, [slug, loadError]);

  if (!isValidBlogSlug(slug)) {
    return <Navigate to="/blog" replace />;
  }

  const category = meta?.category ? getCategoryBySlug(meta.category) : undefined;

  if (loadError) {
    return (
      <BlogLayout navCurrent="article">
        <div className="blog-article-page">
          <div className="blog-article-main">
            <div className="ctn blog-article-state">
              <p className="landing-blog-lead">This article could not be loaded.</p>
              <p>
                <Link to="/blog">← Back to blog</Link>
              </p>
            </div>
          </div>
        </div>
        <LandingFooter supportEmail={SUPPORT_EMAIL} />
      </BlogLayout>
    );
  }

  return (
    <BlogLayout navCurrent="article">
      <div className="blog-article-page">
        <a href="#blog-article-main" className="landing-skip-link">
          Skip to article
        </a>
        <div id="blog-article-main" tabIndex={-1} className="blog-article-main">
          <div className="ctn blog-article-inner">
            <nav className="blog-breadcrumb" aria-label="Breadcrumb">
              <ol className="blog-breadcrumb-list">
                <li className="blog-breadcrumb-item">
                  <Link to="/">Home</Link>
                </li>
                <li className="blog-breadcrumb-item">
                  <Link to="/blog">Blog</Link>
                </li>
                {category ? (
                  <li className="blog-breadcrumb-item">
                    <Link to={`/blog?category=${category.slug}`}>{category.name}</Link>
                  </li>
                ) : null}
                <li className="blog-breadcrumb-item blog-breadcrumb-item--current" aria-current="page">
                  {meta?.title}
                </li>
              </ol>
            </nav>
            <p className="blog-article-kicker">
              <span>{meta?.dateLabel}</span>
              <span aria-hidden> · </span>
              <span>{meta?.readTime}</span>
              {category ? (
                <>
                  <span aria-hidden> · </span>
                  <Link to={`/blog?category=${category.slug}`}>{category.name}</Link>
                </>
              ) : null}
            </p>
            <BlogShareButtons title={meta?.title ?? ""} url={canonicalUrl} />
            <BlogArticleToc toc={toc} />
            <article
              ref={articleRef}
              className="blog-article-prose"
              aria-label={meta?.title ? `Article: ${meta.title}` : "Article body"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <BlogAppCta slug={slug} category={meta?.category} variant="footer" />
            <BlogRelatedPosts currentSlug={slug} />
            <p className="blog-article-back">
              <Link to="/blog">← All articles</Link>
            </p>
          </div>
        </div>
      </div>
      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </BlogLayout>
  );
}
