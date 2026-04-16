import { useEffect, useMemo, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { getBundledPostMarkdown } from "../blog/loadPostMarkdown";
import LandingFooter from "../components/landing/LandingFooter";
import { getPostMetaBySlug, isValidBlogSlug } from "../data/landingBlogPosts";
import { trackBlogArticleView } from "../utils/analytics";
import { getBlogPostUrl, getPublicSiteOrigin } from "../utils/blogPublicUrl";
import { useBlogDocumentMeta } from "../utils/blogPageMeta";
import { addLazyLoadingToBlogImages, parseBlogPostHtml } from "../utils/blogMarkdownRender";
import "../styles/landing.css";

const SUPPORT_EMAIL = "mysafeops@gmail.com";

/**
 * Same-origin /blog/* links inside rendered HTML → client-side navigation.
 */
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

/**
 * @param {{ level: number; text: string; id: string }[]} toc
 */
function BlogArticleToc({ toc }) {
  if (toc.length === 0) return null;
  return (
    <nav className="blog-article-toc" aria-labelledby="blog-toc-heading">
      <h2 id="blog-toc-heading" className="blog-article-toc-title">
        On this page
      </h2>
      <ol className="blog-article-toc-list">
        {toc.map((item) => (
          <li
            key={item.id}
            className={`blog-article-toc-item blog-article-toc-item--h${item.level}`}
          >
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
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
      const safe = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
      const withLazyImages = addLazyLoadingToBlogImages(safe);
      return { html: withLazyImages, toc: headings, loadError: null };
    } catch {
      return { html: "", toc: [], loadError: "parse" };
    }
  }, [slug]);

  useBlogArticleLinkDelegate(articleRef, html);

  const origin = getPublicSiteOrigin();
  const metaForHead = meta && slug && !loadError ? meta : null;
  const canonicalUrl = metaForHead && slug ? getBlogPostUrl(slug) : "";
  useBlogDocumentMeta(
    {
      title: metaForHead ? `${metaForHead.title} · MySafeOps` : "",
      description: metaForHead?.excerpt ?? "",
      canonicalUrl,
      ogImageUrl: metaForHead?.image ? `${origin}${metaForHead.image}` : undefined,
      ogType: "article",
      rssFeedUrl: `${origin}/blog/rss.xml`,
    },
    Boolean(metaForHead),
  );

  useEffect(() => {
    if (slug && metaForHead) trackBlogArticleView(slug);
  }, [slug, metaForHead]);

  const jsonLd = useMemo(() => {
    if (!metaForHead || !slug || loadError) return null;
    const url = getBlogPostUrl(slug);
    const imageUrl = metaForHead.image ? `${origin}${metaForHead.image}` : undefined;
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: metaForHead.title,
      description: metaForHead.excerpt,
      datePublished: metaForHead.publishedIso,
      dateModified: metaForHead.publishedIso,
      ...(imageUrl ? { image: [imageUrl] } : {}),
      url,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": url,
      },
      author: {
        "@type": "Organization",
        name: "MySafeOps",
      },
      publisher: {
        "@type": "Organization",
        name: "MySafeOps",
      },
    };
  }, [metaForHead, slug, loadError, origin]);

  if (!isValidBlogSlug(slug)) {
    return <Navigate to="/blog" replace />;
  }

  if (loadError) {
    return (
      <div className="landing-page blog-article-page">
        <header className="blog-index-header" role="banner">
          <div className="ctn blog-index-header-inner">
            <Link to="/" className="logo">
              <span className="lt" style={{ fontSize: 18 }}>
                <span style={{ color: "var(--teal)" }}>My</span>
                <span style={{ color: "var(--navy)" }}>Safe</span>
                <span style={{ color: "var(--org)" }}>Ops</span>
              </span>
            </Link>
            <nav className="blog-index-nav" aria-label="Article">
              <Link to="/blog">All articles</Link>
            </nav>
          </div>
        </header>
        <main className="blog-article-main">
          <div className="ctn blog-article-state">
            <p className="landing-blog-lead">This article could not be loaded.</p>
            <p>
              <Link to="/blog">← Back to blog</Link>
            </p>
          </div>
        </main>
        <LandingFooter supportEmail={SUPPORT_EMAIL} />
      </div>
    );
  }

  return (
    <div className="landing-page blog-article-page">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <a href="#blog-article-main" className="landing-skip-link">
        Skip to article
      </a>
      <header className="blog-index-header" role="banner">
        <div className="ctn blog-index-header-inner">
          <Link to="/" className="logo">
            <svg viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path
                d="M2 14C2 10.5 4 8.5 6 7.8L20 2C21.2 1.6 22.8 1.6 24 2L38 7.8C40 8.5 42 10.5 42 14V30C42 42 24 50 22 51C20 50 2 42 2 30V14Z"
                fill="#0d9488"
                fillOpacity="0.12"
                stroke="#0d9488"
                strokeWidth="2.5"
              />
              <path d="M13 26L19 32L31 20" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="lt">
              <span>My</span>
              <span>Safe</span>
              <span>Ops</span>
            </div>
          </Link>
          <nav className="blog-index-nav" aria-label="Article">
            <Link to="/">Home</Link>
            <Link to="/blog">All articles</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>

      <main id="blog-article-main" tabIndex={-1} className="blog-article-main">
        <div className="ctn blog-article-inner fu">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <ol className="blog-breadcrumb-list">
              <li className="blog-breadcrumb-item">
                <Link to="/">Home</Link>
              </li>
              <li className="blog-breadcrumb-item">
                <Link to="/blog">Blog</Link>
              </li>
              <li className="blog-breadcrumb-item blog-breadcrumb-item--current" aria-current="page">
                {meta?.title}
              </li>
            </ol>
          </nav>
          <p className="blog-article-kicker">
            <span>{meta?.dateLabel}</span>
            <span aria-hidden> · </span>
            <span>{meta?.readTime}</span>
          </p>
          <BlogArticleToc toc={toc} />
          <article
            ref={articleRef}
            className="blog-article-prose"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <p className="blog-article-back">
            <Link to="/blog">← All articles</Link>
          </p>
        </div>
      </main>

      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
