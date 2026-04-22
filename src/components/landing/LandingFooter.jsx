import { Link } from "react-router-dom";
import { getPublicDocsPath, getPublicStatusPath } from "../../config/publicLinks";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";

export default function LandingFooter({ supportEmail }) {
  const docsTo = getPublicDocsPath();
  const statusTo = getPublicStatusPath();
  const statusIsExternal = /^https?:\/\//i.test(statusTo);
  return (
    <footer role="contentinfo">
      <div className="ctn">
        <div className="fgrid">
          <div className="fb">
            <div className="lt" style={{ fontSize: 18 }}>
              <span style={{ color: "var(--teal-l)" }}>My</span>
              <span style={{ color: "var(--w)" }}>Safe</span>
              <span style={{ color: "var(--org)" }}>Ops</span>
            </div>
            <p>Construction safety workspace for UK sites — RAMS, permits, registers, and evidence in one place.</p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#readiness">Readiness check</a></li>
              <li><a href="#roi">Value</a></li>
              <li><a href="#roles">How it works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li>
                <a href="/blog">Blog</a>
              </li>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#missing">Request feature</a></li>
              <li><a href="#cta">Get started</a></li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              <li>
                <Link to="/login" {...loginLinkPrefetchProps}>
                  Sign in
                </Link>
              </li>
              <li>
                {docsTo.startsWith("http") ? (
                  <a href={docsTo} rel="noopener noreferrer">
                    Documentation
                  </a>
                ) : (
                  <Link to={docsTo}>Documentation</Link>
                )}
              </li>
              <li><a href={`mailto:${supportEmail}`}>Contact</a></li>
              <li>
                {statusIsExternal ? (
                  <a href={statusTo} rel="noopener noreferrer">
                    Service status
                  </a>
                ) : (
                  <Link to={statusTo}>Service status</Link>
                )}
              </li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href={`mailto:${supportEmail}`}>Email us</a></li>
              <li>
                <Link to="/privacy">Privacy policy</Link>
              </li>
              <li>
                <Link to="/terms">Terms of service</Link>
              </li>
              <li>
                <Link to="/cookies">Cookie policy</Link>
              </li>
              <li>
                <Link to="/dpa">Data processing (DPA)</Link>
              </li>
            </ul>
          </div>
        </div>
        <p
          className="cookie-notice"
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.72)",
            margin: "20px 0 0",
            lineHeight: 1.55,
            maxWidth: 52 * 16,
          }}
        >
          MySafeOps uses essential cookies only to keep you signed in — no advertising or cross-site tracking cookies.{" "}
          <Link to="/cookies" style={{ color: "var(--teal-l)", fontWeight: 600 }}>
            Cookie policy
          </Link>
        </p>
        <div className="fbot">
          <span>© {new Date().getFullYear()} MySafeOps</span>
          <span>
            <Link to="/cookies" style={{ color: "inherit", marginRight: 12 }}>
              Cookies
            </Link>
            Help: {supportEmail}
          </span>
        </div>
      </div>
    </footer>
  );
}
