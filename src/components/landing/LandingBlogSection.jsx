import { Link } from "react-router-dom";
import BlogPostsGrid from "./BlogPostsGrid";

export default function LandingBlogSection() {
  return (
    <section className="landing-blog-section" id="blog" aria-labelledby="landing-blog-heading">
      <div className="ctn">
        <div className="sh fu landing-soro-intro landing-blog-intro">
          <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
            Insights
          </div>
          <h2 id="landing-blog-heading">From the blog</h2>
          <p className="landing-blog-lead">
            UK construction safety guides: permits, inductions, toolbox talks, COSHH, and compliance updates.{" "}
            <Link to="/blog" className="landing-blog-index-link">
              View all articles
            </Link>
            . Full text opens on MySafeOps.
          </p>
        </div>
        <BlogPostsGrid variant="landing" />
      </div>
    </section>
  );
}
