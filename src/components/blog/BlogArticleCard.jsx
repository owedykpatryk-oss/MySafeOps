import { Link } from "react-router-dom";
import { formatReadingTimeLabel } from "../../lib/blog/estimateReadingTime";
import { getLandingSectionsCopy } from "../../data/landingSectionsCopy";

/**
 * @param {{
 *   post: import("../../data/landingBlogPosts").BlogPostMeta;
 *   index?: number;
 *   eager?: boolean;
 *   className?: string;
 *   marketId?: import("../../config/markets").MarketId;
 * }} props
 */
export default function BlogArticleCard({ post, index = 0, eager = false, className = "", marketId = "uk" }) {
  const loadEager = eager || index < 3;
  const copy = getLandingSectionsCopy(marketId).blog;
  const readTime = formatReadingTimeLabel(post.readTime, marketId);

  return (
    <li className={`landing-blog-card blog-article-card${className ? ` ${className}` : ""}`}>
      <Link to={`/blog/${post.slug}`} className="landing-blog-card-link">
        <div className="landing-blog-card-image-wrap">
          <img
            src={post.image}
            alt={post.title}
            className="landing-blog-card-image"
            width={640}
            height={360}
            loading={loadEager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index === 0 ? "high" : undefined}
          />
        </div>
        <div className="landing-blog-card-body">
          <div className="landing-blog-card-meta">
            <time dateTime={post.publishedIso}>{post.dateLabel}</time>
            <span aria-hidden> · </span>
            <span>{readTime}</span>
            {post.featured ? (
              <>
                <span aria-hidden> · </span>
                <span className="blog-card-featured">{copy.featured}</span>
              </>
            ) : null}
          </div>
          <h3 className="landing-blog-card-title">{post.title}</h3>
          <p className="landing-blog-card-excerpt">{post.excerpt}</p>
          {post.tags?.length ? (
            <ul className="blog-card-tags" aria-label={copy.tagsAria}>
              {post.tags.slice(0, 3).map((t) => (
                <li key={t}>
                  <span className="blog-tag-pill">{t}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <span className="landing-blog-card-cta">{copy.readArticle}</span>
        </div>
      </Link>
    </li>
  );
}
