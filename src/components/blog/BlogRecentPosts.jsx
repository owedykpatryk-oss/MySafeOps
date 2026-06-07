import { Link } from "react-router-dom";
import { getRecentBlogPosts } from "../../lib/blog/getPosts";

/** @param {{ excludeSlug?: string; limit?: number }} props */
export default function BlogRecentPosts({ excludeSlug, limit = 5 }) {
  const posts = getRecentBlogPosts(limit + 1).filter((p) => p.slug !== excludeSlug).slice(0, limit);
  if (!posts.length) return null;

  return (
    <aside className="blog-recent" aria-labelledby="blog-recent-heading">
      <h2 id="blog-recent-heading" className="blog-recent-title">
        Recent guides
      </h2>
      <ul className="blog-recent-list">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link to={`/blog/${p.slug}`} className="blog-recent-link">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
