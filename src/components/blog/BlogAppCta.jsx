import { Link } from "react-router-dom";
import { trackBlogCtaClick } from "../../utils/analytics";

const COPY_BY_CATEGORY = {
  permits: {
    headline: "Digital permits that work offline on site",
    body: "Hot work, confined space, height and electrical — issue, approve and close out with evidence. Worker accounts free.",
  },
  "rams-compliance": {
    headline: "RAMS and compliance without the paper chase",
    body: "Build method statements, track sign-off, and keep audit-ready records in one UK-native workspace.",
  },
  "site-operations": {
    headline: "Briefings and inductions workers actually use",
    body: "Toolbox talks, inductions and site records on mobile — flat org pricing, not per-seat.",
  },
  registers: {
    headline: "Registers at the point of work",
    body: "COSHH, equipment and site logs searchable from phone or tablet — no binder hunting.",
  },
  product: {
    headline: "Try MySafeOps free on your next site",
    body: "UK construction safety software with free worker accounts. See if it fits before you commit.",
  },
};

/**
 * In-article promo block → /login (app signup).
 * @param {{ slug?: string; category?: string; variant?: "inline" | "footer" }} props
 */
export default function BlogAppCta({ slug, category = "product", variant = "footer" }) {
  const copy = COPY_BY_CATEGORY[category] || COPY_BY_CATEGORY.product;

  const onCta = (target) => {
    if (slug) trackBlogCtaClick(slug, `${variant}_${target}`);
  };

  return (
    <aside
      className={`blog-app-cta blog-app-cta--${variant}`}
      aria-label="Try MySafeOps"
    >
      <div className="blog-app-cta-inner">
        <p className="blog-app-cta-badge">MySafeOps</p>
        <h2 className="blog-app-cta-title">{copy.headline}</h2>
        <p className="blog-app-cta-body">{copy.body}</p>
        <div className="blog-app-cta-actions">
          <Link to="/login" className="blog-app-cta-primary" onClick={() => onCta("login")}>
            Start free →
          </Link>
          <a href="/#pricing" className="blog-app-cta-secondary" onClick={() => onCta("pricing")}>
            View pricing
          </a>
        </div>
      </div>
    </aside>
  );
}
