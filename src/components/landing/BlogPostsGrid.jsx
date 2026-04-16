import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LANDING_BLOG_POSTS } from "../../data/landingBlogPosts";

/**
 * `/blog` index sorts newest first; landing section keeps editorial order from `LANDING_BLOG_POSTS`.
 * @param {{ variant?: "landing" | "page", className?: string }} props
 */
export default function BlogPostsGrid({ variant = "landing", className = "" }) {
  const isPage = variant === "page";

  const posts = useMemo(() => {
    if (!isPage) return LANDING_BLOG_POSTS;
    return [...LANDING_BLOG_POSTS].sort((a, b) =>
      String(b.publishedIso || "").localeCompare(String(a.publishedIso || "")),
    );
  }, [isPage]);

  return (
    <div className={`landing-blog-grid-wrap ${className}`.trim()}>
      <ul className={`landing-blog-grid ${isPage ? "landing-blog-grid--page" : ""}`.trim()}>
        {posts.map((post, index) => (
          <li key={post.slug} className={`landing-blog-card${isPage ? "" : " fu"}`}>
            <Link to={`/blog/${post.slug}`} className="landing-blog-card-link">
              <div className="landing-blog-card-image-wrap">
                <img
                  src={post.image}
                  alt={post.title}
                  className="landing-blog-card-image"
                  width={640}
                  height={360}
                  loading={index < 3 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : undefined}
                />
              </div>
              <div className="landing-blog-card-body">
                <div className="landing-blog-card-meta">
                  <time dateTime={post.publishedIso ?? "2026-04-16"}>{post.dateLabel}</time>
                  <span aria-hidden> · </span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="landing-blog-card-title">{post.title}</h3>
                <p className="landing-blog-card-excerpt">{post.excerpt}</p>
                <span className="landing-blog-card-cta">Read article →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
