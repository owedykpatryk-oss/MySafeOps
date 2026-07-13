import { Link } from "react-router-dom";
import { getPublicDocsPath, getPublicStatusPath } from "../../config/publicLinks";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import { getMarket, getAlternateMarkets } from "../../config/markets";
import { getLandingSectionsCopy } from "../../data/landingSectionsCopy";

/** @param {{ supportEmail: string; market?: import("../../config/markets").MarketConfig; copy?: import("../../data/landingMarketContent").LANDING_MARKET_CONTENT.uk }} props */
export default function LandingFooter({ supportEmail, market = getMarket("uk"), copy }) {
  const footerCopy = copy ?? { footerBlurb: "Construction safety workspace — RAMS, permits, registers, and evidence in one place." };
  const labels = getLandingSectionsCopy(market.id).footer;
  const loginTo = market.loginPath;
  const alternateMarkets = getAlternateMarkets(market.id);
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
            <p>{footerCopy.footerBlurb}</p>
            <p style={{ fontSize: 13, marginTop: 12, opacity: 0.85 }}>
              {labels.region} <strong>{market.flag} {market.label}</strong>
              {alternateMarkets.map((alt) => (
                <span key={alt.id}>
                  {" · "}
                  <Link to={alt.homePath} style={{ color: "var(--teal-l)", fontWeight: 600 }}>
                    {alt.flag} {alt.label}
                  </Link>
                </span>
              ))}
            </p>
          </div>
          <div>
            <h4>{labels.product}</h4>
            <ul>
              <li><a href="#features">{market.id === "pl" ? "Funkcje" : "Features"}</a></li>
              <li><a href="#modules">{market.id === "pl" ? "Moduły" : "Modules"}</a></li>
              <li><a href="#readiness">{market.id === "pl" ? "Test gotowości" : "Readiness check"}</a></li>
              <li><a href="#roi">{market.id === "pl" ? "Korzyści" : "Value"}</a></li>
              <li><a href="#roles">{market.id === "pl" ? "Jak to działa" : "How it works"}</a></li>
              <li><a href="#pricing">{market.id === "pl" ? "Cennik" : "Pricing"}</a></li>
              <li>
                <Link to="/blog">Blog</Link>
              </li>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#missing">{market.id === "pl" ? "Zgłoś funkcję" : "Request feature"}</a></li>
              <li><a href="#cta">{market.id === "pl" ? "Wypróbuj" : "Get started"}</a></li>
            </ul>
          </div>
          <div>
            <h4>{labels.resources}</h4>
            <ul>
              <li>
                <Link to={loginTo} {...loginLinkPrefetchProps}>
                  {labels.signIn}
                </Link>
              </li>
              <li>
                {docsTo.startsWith("http") ? (
                  <a href={docsTo} rel="noopener noreferrer">
                    {labels.docs}
                  </a>
                ) : (
                  <Link to={docsTo}>{labels.docs}</Link>
                )}
              </li>
              <li><a href={`mailto:${supportEmail}`}>{labels.contact}</a></li>
              <li>
                {statusIsExternal ? (
                  <a href={statusTo} rel="noopener noreferrer">
                    {labels.status}
                  </a>
                ) : (
                  <Link to={statusTo}>{labels.status}</Link>
                )}
              </li>
              <li>
                <Link to="/security">{labels.security}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>{labels.company}</h4>
            <ul>
              <li><a href={`mailto:${supportEmail}`}>{labels.emailUs}</a></li>
              <li>
                <Link to={market.privacyPath}>{labels.privacy}</Link>
              </li>
              <li>
                <Link to={market.termsPath}>{labels.terms}</Link>
              </li>
              <li>
                <Link to={market.cookiesPath}>{labels.cookies}</Link>
              </li>
              <li>
                <Link to={market.dpaPath}>{labels.dpa}</Link>
              </li>
              <li>
                <Link to={market.accessibilityPath}>{labels.accessibility}</Link>
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
          {labels.cookieNotice}{" "}
          <Link to={market.cookiesPath} style={{ color: "var(--teal-l)", fontWeight: 600 }}>
            {labels.cookiePolicy}
          </Link>
        </p>
        <div className="fbot">
          <span>© {new Date().getFullYear()} MySafeOps</span>
          <span>
            <Link to={market.cookiesPath} style={{ color: "inherit", marginRight: 12 }}>
              {market.id === "pl" ? "Cookies" : "Cookies"}
            </Link>
            {labels.help} {supportEmail}
          </span>
        </div>
      </div>
    </footer>
  );
}
