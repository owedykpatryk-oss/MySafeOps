import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import { LANDING_RAMS_PACK_COUNT } from "./landingShowcaseData";
import LandingHeroMockup from "./LandingHeroMockup";
import LandingHeroLiveStrip from "./LandingHeroLiveStrip";
import LandingMarketRibbon from "./LandingMarketRibbon";
import LandingSectorMarquee from "./LandingSectorMarquee";
import { getLandingNavLinks } from "../../data/landingMarketContent";
import { getLandingSectionsCopy } from "../../data/landingSectionsCopy";

export default function LandingTopSection({ navScrolled, cloud, market, copy }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loginTo = market.loginPath;
  const nav = getLandingNavLinks(market.id);
  const sections = getLandingSectionsCopy(market.id);
  const mobileLinks = nav.mobile;
  const desktopLinks = nav.desktop;

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

      <section className="hero" aria-labelledby="landing-hero-heading">
        <div className="hero-mesh" aria-hidden />
        <div className="hero-orb hero-orb--teal" aria-hidden />
        <div className="hero-orb hero-orb--org" aria-hidden />
        {market.id === "pl" && <div className="hero-orb hero-orb--pl" aria-hidden />}
        <LandingMarketRibbon market={market} />
        <div className="ctn">
          <div className="hg">
            <div className="hero-copy fu vi">
              <div className="badge hb landing-badge-pulse">{copy.heroBadge}</div>
              <h1 id="landing-hero-heading">
                {sections.hero.titleLine1}
                <br />
                <span className="hl landing-hl-shimmer">{sections.hero.titleLine2}</span>
              </h1>
              <p className="hero-lead">
                <span className="hero-lead-full">
                  {copy.heroLeadFull}
                  {cloud ? " with cloud sign-in and backup enabled on this deployment." : " with optional cloud backup when Supabase is configured."}
                </span>
                <span className="hero-lead-short">
                  {copy.heroLeadShort}
                  {cloud ? ", cloud backup enabled." : "."}
                </span>
              </p>
              <div className="hbs">
                <Link to={loginTo} className="btn btn-p landing-btn-glow" {...loginLinkPrefetchProps}>
                  {nav.heroGetStarted}
                </Link>
                <a href="#profiles" className="btn btn-o hero-btn-secondary">
                  {nav.heroSeeProfiles}
                </a>
                <a href="#readiness" className="btn btn-o hero-btn-tertiary">
                  {nav.heroQuickCheck}
                </a>
              </div>
              <div className="landing-trust-strip landing-trust-pills" role="note">
                {copy.trustPills.map((pill) => (
                  <span key={pill} className={pill.includes("backup") ? "landing-trust-pill--hide-sm" : undefined}>
                    {pill}
                  </span>
                ))}
              </div>
              <div className="hs" aria-label="Product highlights">
                <div>
                  <strong>40+</strong>
                  <span>{sections.hero.modulesStat}</span>
                </div>
                <div>
                  <strong>{LANDING_RAMS_PACK_COUNT}+</strong>
                  <span>{copy.ramsLabel}</span>
                </div>
                <div>
                  <strong>9</strong>
                  <span>{sections.hero.profilesStat}</span>
                </div>
                <div>
                  <strong>14d</strong>
                  <span>{sections.hero.trialStat}</span>
                </div>
              </div>
              <LandingHeroLiveStrip marketId={market.id} />
            </div>
            <div className="pw fu vi">
              <LandingHeroMockup marketId={market.id} />
            </div>
          </div>
        </div>
        <LandingSectorMarquee marketId={market.id} />
      </section>
    </>
  );
}
