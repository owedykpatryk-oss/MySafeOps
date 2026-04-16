import { Link } from "react-router-dom";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";

export default function LandingFooter({ supportEmail }) {
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
              <li><a href={`mailto:${supportEmail}`}>Contact</a></li>
              <li><span style={{ cursor: "default", opacity: 0.7 }}>Documentation (coming soon)</span></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href={`mailto:${supportEmail}`}>Email us</a></li>
              <li><span style={{ cursor: "default", opacity: 0.7 }}>Privacy & terms (coming soon)</span></li>
            </ul>
          </div>
        </div>
        <div className="fbot">
          <span>© {new Date().getFullYear()} MySafeOps</span>
          <span>Help: {supportEmail}</span>
        </div>
      </div>
    </footer>
  );
}
