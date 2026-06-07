import { useMemo } from "react";
import { Link } from "react-router-dom";
import { queryBlogPosts } from "../../lib/blog/getPosts";
import BlogArticleCard from "../blog/BlogArticleCard";

/**
 * @param {{ variant?: "landing" | "page", className?: string, featuredOnly?: boolean, limit?: number }} props
 */
export default function BlogPostsGrid({ variant = "landing", className = "", featuredOnly = false, limit }) {
  const isPage = variant === "page";

  const posts = useMemo(() => {
    if (featuredOnly) {
      return queryBlogPosts({ featuredOnly: true }).slice(0, limit ?? 4);
    }
    if (!isPage) {
      return limit ? queryBlogPosts({}).slice(0, limit) : queryBlogPosts({});
    }
    return queryBlogPosts({});
  }, [isPage, featuredOnly, limit]);

  if (isPage) {
    return null;
  }

  return (
    <div className={`landing-blog-grid-wrap ${className}`.trim()}>
      <ul className="landing-blog-grid">
        {posts.map((post, index) => (
          <BlogArticleCard key={post.slug} post={post} index={index} eager={index < 2} className="fu" />
        ))}
      </ul>
    </div>
  );
}
