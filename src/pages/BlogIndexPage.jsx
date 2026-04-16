import { useEffect } from "react";
import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import BlogPostsGrid from "../components/landing/BlogPostsGrid";
import { LANDING_BLOG_POSTS } from "../data/landingBlogPosts";
import { trackBlogIndexView } from "../utils/analytics";
import { getPublicSiteOrigin } from "../utils/blogPublicUrl";
import { useBlogDocumentMeta } from "../utils/blogPageMeta";
import "../styles/landing.css";

const SUPPORT_EMAIL = "mysafeops@gmail.com";
const TITLE = "Blog — UK construction safety guides | MySafeOps";
const DESCRIPTION =
  "Practical UK construction safety guides for site managers and H&S leads: permits, inductions, toolbox talks, COSHH, and compliance updates.";

export default function BlogIndexPage() {
  const origin = getPublicSiteOrigin();

  const defaultOgImage = LANDING_BLOG_POSTS[0]?.image;

  useBlogDocumentMeta({
    title: TITLE,
    description: DESCRIPTION,
    canonicalUrl: `${origin}/blog`,
    ogType: "website",
    ogImageUrl: defaultOgImage ? `${origin}${defaultOgImage}` : undefined,
    rssFeedUrl: `${origin}/blog/rss.xml`,
  });

  useEffect(() => {
    trackBlogIndexView();
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("blog-smooth-scroll");
    return () => document.documentElement.classList.remove("blog-smooth-scroll");
  }, []);

  return (
    <div className="landing-page blog-index-page">
      <a href="#blog-main" className="landing-skip-link">
        Skip to main content
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
          <nav className="blog-index-nav" aria-label="Blog section">
            <Link to="/">Home</Link>
            <span className="blog-index-nav-current" aria-current="page">
              Blog
            </span>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>

      <main id="blog-main" tabIndex={-1}>
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
                Practical articles for site managers and H&amp;S leads. Open any guide below to read the full article on MySafeOps.
              </p>
              <p className="landing-blog-rss-note">
                <a href="/blog/rss.xml" className="landing-blog-index-link">
                  RSS feed
                </a>{" "}
                for updates.
              </p>
            </div>
            <BlogPostsGrid variant="page" />
          </div>
        </section>
      </main>

      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
