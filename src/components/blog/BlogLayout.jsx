import { Link } from "react-router-dom";
import { useBlogTheme } from "../../hooks/blog/useBlogTheme";
import BlogThemeToggle from "./BlogThemeToggle";

/** @param {{ children: import("react").ReactNode; navCurrent?: "blog" | "article" }} props */
export default function BlogLayout({ children, navCurrent = "blog" }) {
  const { mode, cycleTheme } = useBlogTheme();

  return (
    <div className="landing-page blog-layout">
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
            {navCurrent === "blog" ? (
              <span className="blog-index-nav-current" aria-current="page">
                Blog
              </span>
            ) : (
              <Link to="/blog">All articles</Link>
            )}
            <BlogThemeToggle mode={mode} onToggle={cycleTheme} />
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>
      <main id="blog-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
