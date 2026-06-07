import { Link } from "react-router-dom";
import { getRelatedBlogPosts } from "../../lib/blog/getPosts";

/** @param {{ currentSlug: string; limit?: number }} props */
export default function BlogRelatedPosts({ currentSlug, limit = 3 }) {
  const posts = getRelatedBlogPosts(currentSlug, limit);
  if (posts.length === 0) return null;

  return (
    <aside className="blog-related" aria-labelledby="blog-related-heading">
      <h2 id="blog-related-heading" className="blog-related-title">
        More guides
      </h2>
      <ul className="blog-related-list">
        {posts.map((p) => (
          <li key={p.slug} className="blog-related-item">
            <Link to={`/blog/${p.slug}`} className="blog-related-link">
              <span className="blog-related-link-title">{p.title}</span>
              <span className="blog-related-link-meta">
                {p.dateLabel}
                <span aria-hidden> · </span>
                {p.readTime}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
