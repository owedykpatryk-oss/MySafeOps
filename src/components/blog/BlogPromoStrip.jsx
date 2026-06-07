import { Link } from "react-router-dom";
import { trackBlogCtaClick } from "../../utils/analytics";

/** Slim banner on blog index — drives signups from SEO traffic */
export default function BlogPromoStrip() {
  return (
    <div className="blog-promo-strip" role="region" aria-label="Try MySafeOps">
      <div className="blog-promo-strip-inner">
        <p className="blog-promo-strip-text">
          <strong>Running a UK site?</strong> RAMS, permits, toolbox talks and 40+ registers — free worker accounts.
        </p>
        <Link
          to="/login"
          className="blog-promo-strip-btn"
          onClick={() => trackBlogCtaClick("blog-index", "strip_login")}
        >
          Start free
        </Link>
      </div>
    </div>
  );
}
