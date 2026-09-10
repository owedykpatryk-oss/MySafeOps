import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileCheck2, Menu, ShieldCheck, WifiOff, X } from "lucide-react";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import LandingMarketRibbon from "./LandingMarketRibbon";
import { getLandingNavLinks } from "../../data/landingMarketContent";

export default function LandingTopSection({ navScrolled, market, copy }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loginTo = market.loginPath;
  const nav = getLandingNavLinks(market.id);
  const mobileLinks = nav.mobile;
  const desktopLinks = nav.desktop;
  const hero = market.id === "pl"
    ? {
        title: "Operacje BHP dla ekip, które pracują w terenie.",
        lead: "Twórz IOR, kontroluj pozwolenia i utrzymuj dowody gotowe do audytu — w jednym środowisku dla biura i budowy.",
        secondary: "Zobacz produkt",
        proof: ["Działa offline", "Kontrola dostępu", "Eksporty PDF"],
        screen: "Prawdziwy widok aplikacji · Management Overview",
      }
    : market.id === "au"
      ? {
          title: "Safety operations for Australian site teams.",
          lead: "Create SWMS, control permits and keep site evidence ready for review — in one workspace for office and field teams.",
          secondary: "See the product",
          proof: ["Offline capable", "Role-based access", "Audit-ready PDFs"],
          screen: "Real product view · Management Overview",
        }
      : {
          title: "Safety operations for UK site teams.",
          lead: "Create RAMS, control permits and keep site evidence ready for audit — in one workspace for management and site teams.",
          secondary: "See the product",
          proof: ["Offline capable", "Role-based access", "Audit-ready PDFs"],
          screen: "Real product view · Management Overview",
        };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("landing-mobile-menu-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      document.body.classList.remove("landing-mobile-menu-open");
    };
  }, [mobileOpen]);

  return (
    <>
      <nav className={`landing-top-nav${navScrolled ? " sc" : ""}`} aria-label="Primary">
        <div className="ctn">
          <div className="ni">
            <Link to={market.homePath} className="logo">
              <svg viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  d="M2 14C2 10.5 4 8.5 6 7.8L20 2C21.2 1.6 22.8 1.6 24 2L38 7.8C40 8.5 42 10.5 42 14V30C42 42 24 50 22 51C20 50 2 42 2 30V14Z"
                  fill="#0d9488"
                  fillOpacity="0.12"
                  stroke="#0d9488"
                  strokeWidth="2.5"
                />
                <path d="M13 26L19 32L31 20" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="lt">
                <span>My</span>
                <span>Safe</span>
                <span>Ops</span>
              </div>
              {market.id !== "uk" && (
                <span className={`landing-nav-market-pill${navScrolled ? " landing-nav-market-pill--sc" : ""}`}>
                  {market.flag} {market.label}
                </span>
              )}
            </Link>
            <div className="nl">
              {desktopLinks.map((item) =>
                item.spa ? (
                  <Link key={item.href} to={item.href} className={item.compactHide ? "nl-link--compact-hide" : undefined}>
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.href} href={item.href} className={item.compactHide ? "nl-link--compact-hide" : undefined}>
                    {item.label}
                  </a>
                )
              )}
              <Link to={loginTo} className="btn btn-o nc" {...loginLinkPrefetchProps}>
                {nav.signIn}
              </Link>
              <Link to={loginTo} className="btn btn-p nc" {...loginLinkPrefetchProps}>
                {nav.getStarted}
              </Link>
            </div>
            <button
              type="button"
              className="landing-nav-mobile-toggle"
              aria-expanded={mobileOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? (
                <>
                  <X size={22} strokeWidth={2} aria-hidden />
                  <span className="landing-sr-only">Close menu</span>
                </>
              ) : (
                <>
                  <Menu size={22} strokeWidth={2} aria-hidden />
                  <span className="landing-sr-only">Open menu</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="landing-mobile-overlay" id="landing-mobile-nav" role="dialog" aria-modal="true" aria-label="Site sections">
          <button type="button" className="landing-mobile-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <div className="landing-mobile-panel">
            <div className="landing-mobile-panel-head">
              <span style={{ fontWeight: 800, fontSize: 16, color: "var(--navy)" }}>Menu</span>
              <button type="button" className="landing-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X size={22} />
              </button>
            </div>
            <div className="landing-mobile-links">
              {mobileLinks.map((item) =>
                item.spa ? (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => {
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                  </a>
                )
              )}
              <Link
                to={loginTo}
                className="landing-mobile-cta"
                {...loginLinkPrefetchProps}
                onClick={() => setMobileOpen(false)}
              >
                {nav.signIn}
              </Link>
              <Link
                to={loginTo}
                className="landing-mobile-cta landing-mobile-cta-primary"
                {...loginLinkPrefetchProps}
                onClick={() => setMobileOpen(false)}
              >
                {nav.getStarted}
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="hero hero--v2" aria-labelledby="landing-hero-heading">
        <div className="hero-mesh" aria-hidden />
        <div className="hero-orb hero-orb--teal" aria-hidden />
        <div className="hero-orb hero-orb--org" aria-hidden />
        {market.id === "pl" && <div className="hero-orb hero-orb--pl" aria-hidden />}
        <LandingMarketRibbon market={market} />
        <div className="ctn">
          <div className="hg landing-v2-hero-grid">
            <div className="hero-copy fu vi">
              <div className="badge hb landing-v2-kicker"><ShieldCheck size={14} /> {copy.heroBadge}</div>
              <h1 id="landing-hero-heading">{hero.title}</h1>
              <p className="hero-lead">{hero.lead}</p>
              <div className="hbs">
                <Link to={loginTo} className="btn btn-p landing-btn-glow" {...loginLinkPrefetchProps}>
                  {nav.getStarted} <ArrowRight size={17} />
                </Link>
                <a href="#profiles" className="btn btn-o hero-btn-secondary">
                  {hero.secondary}
                </a>
              </div>
              <div className="landing-v2-proof" role="note">
                {[WifiOff, ShieldCheck, FileCheck2].map((Icon, index) => (
                  <span key={hero.proof[index]}><Icon size={15} />{hero.proof[index]}</span>
                ))}
              </div>
              <div className="landing-v2-evaluation"><CheckCircle2 size={16} /><span><strong>14-day full evaluation.</strong> No card required to explore the workspace.</span></div>
            </div>
            <div className="pw landing-v2-hero-product fu vi">
              <div className="landing-v2-browser">
                <div className="landing-v2-browser__bar"><i /><i /><i /><span>app.mysafeops.com</span></div>
                <img src="/product/management-overview.png" alt="MySafeOps Management Overview showing live programme, readiness and team capacity" />
              </div>
              <div className="landing-v2-screen-note"><span><i /> Live workspace</span><small>{hero.screen}</small></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
