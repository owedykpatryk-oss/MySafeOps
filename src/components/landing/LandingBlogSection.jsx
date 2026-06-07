import { Link } from "react-router-dom";
import BlogPostsGrid from "./BlogPostsGrid";
import { LANDING_BLOG_POSTS } from "../../data/landingBlogPosts";

export default function LandingBlogSection() {
  return (
    <section className="landing-blog-section" id="blog" aria-labelledby="landing-blog-heading">
      <div className="ctn">
        <div className="sh fu landing-blog-intro">
          <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
            Insights
          </div>
          <h2 id="landing-blog-heading">From the blog</h2>
          <p className="landing-blog-lead">
            UK construction safety guides — permits, RAMS, inductions and compliance.{" "}
            <Link to="/blog" className="landing-blog-index-link">
              Browse all {LANDING_BLOG_POSTS.length} articles
            </Link>
            .
          </p>
        </div>
        <BlogPostsGrid variant="landing" featuredOnly limit={4} />
        <p className="landing-blog-more fu">
          <Link to="/blog" className="landing-blog-more-link">
            See all guides →
          </Link>
        </p>
      </div>
    </section>
  );
}
