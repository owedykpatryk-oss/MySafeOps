import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronUp } from "lucide-react";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";
import { getLandingNavLinks } from "../../data/landingMarketContent";

/** @typedef {import("../../config/markets").MarketId} MarketId */

/** @type {Record<MarketId, { href: string; label: string }[]>} */
const JUMP_HREFS = {
  uk: [
    { href: "#workflow", label: "Flow" },
    { href: "#profiles", label: "Profiles" },
    { href: "#readiness", label: "Check" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  au: [
    { href: "#workflow", label: "Flow" },
    { href: "#profiles", label: "Profiles" },
    { href: "#readiness", label: "Check" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  pl: [
    { href: "#workflow", label: "Proces" },
    { href: "#profiles", label: "Profile" },
    { href: "#readiness", label: "Gotowość" },
    { href: "#pricing", label: "Cennik" },
    { href: "#faq", label: "FAQ" },
  ],
};

/** @type {Record<MarketId, { primary: string; secondary: string; scrollTop: string; jumpNav: string }>} */
const CHROME_COPY = {
  uk: {
    primary: "Start evaluation →",
    secondary: "Plans",
    scrollTop: "Back to top",
    jumpNav: "Jump to section",
  },
  au: {
    primary: "Start evaluation →",
    secondary: "Plans",
    scrollTop: "Back to top",
    jumpNav: "Jump to section",
  },
  pl: {
    primary: "Wypróbuj →",
    secondary: "Cennik",
    scrollTop: "Do góry",
    jumpNav: "Skocz do sekcji",
  },
};

function useMobileLandingChrome() {
  const [heroVisible, setHeroVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(".landing-page .hero");
    const footerTargets = ["#cta", ".landing-page footer"].map((s) => document.querySelector(s)).filter(Boolean);

    const heroObs =
      hero &&
      new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), {
        threshold: 0,
        rootMargin: "-64px 0px 0px 0px",
      });
    if (hero && heroObs) heroObs.observe(hero);

    const footerObs = new IntersectionObserver(
      (entries) => setFooterVisible(entries.some((e) => e.isIntersecting)),
      { threshold: 0, rootMargin: "0px 0px -48px 0px" }
    );
    footerTargets.forEach((el) => footerObs.observe(el));

    const onScroll = () => setShowScrollTop(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const syncMenu = () => setMenuOpen(document.body.classList.contains("landing-mobile-menu-open"));
    syncMenu();
    const menuMutation = new MutationObserver(syncMenu);
    menuMutation.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    const root = document.querySelector(".landing-page");
    return () => {
      heroObs?.disconnect();
      footerObs.disconnect();
      window.removeEventListener("scroll", onScroll);
      menuMutation.disconnect();
      root?.classList.remove("landing-sticky-cta-suppressed");
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector(".landing-page");
    root?.classList.toggle("landing-sticky-cta-suppressed", menuOpen);
  }, [menuOpen]);

  const showJumpNav = !heroVisible && !footerVisible && !menuOpen;
  const showCtaBar = !heroVisible && !footerVisible && !menuOpen;
  const showTop = showScrollTop && !footerVisible && !menuOpen;

  useEffect(() => {
    const root = document.querySelector(".landing-page");
    root?.classList.toggle("landing-has-mobile-cta", showCtaBar);
    root?.classList.toggle("landing-jump-visible", showJumpNav);
    return () => {
      root?.classList.remove("landing-has-mobile-cta", "landing-jump-visible");
    };
  }, [showCtaBar, showJumpNav]);

  return { showJumpNav, showCtaBar, showTop };
}

/**
 * Mobile-only jump nav, sticky CTA, and scroll-to-top — avoids stacking on hero/footer.
 * @param {{ marketId?: MarketId; loginTo?: string; copy?: ReturnType<typeof import("../../data/landingMarketContent").getLandingMarketContent> }} props
 */
export default function LandingMobileChrome({ marketId = "uk", loginTo = "/login" }) {
  const { showJumpNav, showCtaBar, showTop } = useMobileLandingChrome();
  const nav = getLandingNavLinks(marketId);
  const chrome = CHROME_COPY[marketId] ?? CHROME_COPY.uk;
  const jumpLinks = useMemo(() => JUMP_HREFS[marketId] ?? JUMP_HREFS.uk, [marketId]);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <nav
        className={`landing-mobile-jump${showJumpNav ? " landing-mobile-jump--visible" : ""}`}
        aria-label={chrome.jumpNav}
      >
        <div className="landing-mobile-jump__track landing-scroll-row">
          {jumpLinks.map((item) => (
            <a key={item.href} href={item.href} className="landing-mobile-jump__chip">
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <button
        type="button"
        className={`landing-scroll-top${showTop ? " landing-scroll-top--visible" : ""}`}
        aria-label={chrome.scrollTop}
        onClick={scrollTop}
      >
        <ChevronUp size={22} strokeWidth={2.5} aria-hidden />
      </button>

      <aside
        className={`landing-mobile-cta-bar${showCtaBar ? "" : " landing-mobile-cta-bar--hidden"}`}
        aria-label={nav.getStarted}
        aria-hidden={!showCtaBar}
      >
        <Link to={loginTo} className="btn btn-p landing-btn-glow landing-mobile-cta-bar__primary" {...loginLinkPrefetchProps}>
          {chrome.primary}
        </Link>
        <a href="#pricing" className="landing-mobile-cta-bar__secondary">
          {chrome.secondary}
        </a>
      </aside>
    </>
  );
}
