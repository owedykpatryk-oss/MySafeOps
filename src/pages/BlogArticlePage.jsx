import { useEffect, useMemo, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { marked } from "marked";
import { getBundledPostMarkdown } from "../blog/loadPostMarkdown";
import LandingFooter from "../components/landing/LandingFooter";
import { getPostMetaBySlug, isValidBlogSlug } from "../data/landingBlogPosts";
import { prepareBlogMarkdown } from "../utils/blogMarkdown";
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

export default function BlogArticlePage() {
  const { slug } = useParams();
  const articleRef = useRef(null);

  const meta = slug ? getPostMetaBySlug(slug) : null;

  const { html, loadError } = useMemo(() => {
    if (!slug || !isValidBlogSlug(slug)) {
      return { html: "", loadError: null };
    }
    const raw = getBundledPostMarkdown(slug);
    if (!raw) {
      return { html: "", loadError: "missing" };
    }
    try {
      const md = prepareBlogMarkdown(raw);
      const out = marked.parse(md, { async: false, gfm: true });
      return { html: typeof out === "string" ? out : String(out), loadError: null };
    } catch {
      return { html: "", loadError: "parse" };
    }
  }, [slug]);

  useBlogArticleLinkDelegate(articleRef, html);

  useEffect(() => {
    if (!meta?.title) return undefined;
    const prev = document.title;
    document.title = `${meta.title} · MySafeOps`;
    return () => {
      document.title = prev;
    };
  }, [meta?.title]);

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
          <p className="blog-article-kicker">
            <Link to="/blog">Blog</Link>
            <span aria-hidden> · </span>
            <span>{meta?.dateLabel}</span>
            <span aria-hidden> · </span>
            <span>{meta?.readTime}</span>
          </p>
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
