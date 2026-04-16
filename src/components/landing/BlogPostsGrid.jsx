import { getBlogPostUrl } from "../../utils/blogPublicUrl";
import { LANDING_BLOG_POSTS } from "../../data/landingBlogPosts";

/**
 * @param {{ variant?: "landing" | "page", className?: string }} props
 */
export default function BlogPostsGrid({ variant = "landing", className = "" }) {
  const isPage = variant === "page";
  return (
    <div className={`landing-blog-grid-wrap ${className}`.trim()}>
      <ul className={`landing-blog-grid ${isPage ? "landing-blog-grid--page" : ""}`.trim()}>
        {LANDING_BLOG_POSTS.map((post) => (
          <li key={post.slug} className="landing-blog-card fu">
            <a href={getBlogPostUrl(post.slug)} className="landing-blog-card-link" target="_blank" rel="noopener noreferrer">
              <div className="landing-blog-card-image-wrap">
                <img
                  src={post.image}
                  alt={post.title}
                  className="landing-blog-card-image"
                  width={640}
                  height={360}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="landing-blog-card-body">
                <div className="landing-blog-card-meta">
                  <time dateTime="2026-04-16">{post.dateLabel}</time>
                  <span aria-hidden> · </span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="landing-blog-card-title">{post.title}</h3>
                <p className="landing-blog-card-excerpt">{post.excerpt}</p>
                <span className="landing-blog-card-cta">Read article →</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
