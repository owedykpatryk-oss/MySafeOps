import { Link } from "react-router-dom";
import BlogPostsGrid from "./BlogPostsGrid";
import { LANDING_BLOG_POSTS } from "../../data/landingBlogPosts";
import { getLandingBlogTag, getLandingSectionsCopy } from "../../data/landingSectionsCopy";
import { queryBlogPosts } from "../../lib/blog/getPosts";

/** @param {{ marketId?: import("../../config/markets").MarketId }} props */
export default function LandingBlogSection({ marketId = "uk" }) {
  const copy = getLandingSectionsCopy(marketId);
  const tag = getLandingBlogTag(marketId);
  const taggedCount = queryBlogPosts({ tag }).length;
  const postCount = taggedCount > 0 ? taggedCount : LANDING_BLOG_POSTS.length;

  return (
    <section className="landing-blog-section" id="blog" aria-labelledby="landing-blog-heading">
      <div className="ctn">
        <div className="sh fu landing-blog-intro">
          <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
            {copy.blog.badge}
          </div>
          <h2 id="landing-blog-heading">{copy.blog.title}</h2>
          <p className="landing-blog-lead">
            {copy.blog.lead(postCount)}{" "}
            <Link to="/blog" className="landing-blog-index-link">
              {copy.blog.browseAll}
            </Link>
            .
          </p>
        </div>
        <BlogPostsGrid variant="landing" tag={tag} limit={4} marketId={marketId} />
        <p className="landing-blog-more fu">
          <Link to="/blog" className="landing-blog-more-link">
            {copy.blog.seeAll}
          </Link>
        </p>
      </div>
    </section>
  );
}
