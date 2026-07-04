import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronUp } from "lucide-react";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";

const JUMP_LINKS = [
  { href: "#workflow", label: "Flow" },
  { href: "#profiles", label: "Profiles" },
  { href: "#readiness", label: "Check" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

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

/** Mobile-only jump nav, sticky CTA, and scroll-to-top — avoids stacking on hero/footer. */
export default function LandingMobileChrome() {
  const { showJumpNav, showCtaBar, showTop } = useMobileLandingChrome();

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <nav
        className={`landing-mobile-jump${showJumpNav ? " landing-mobile-jump--visible" : ""}`}
        aria-label="Jump to section"
      >
        <div className="landing-mobile-jump__track landing-scroll-row">
          {JUMP_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="landing-mobile-jump__chip">
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <button
        type="button"
        className={`landing-scroll-top${showTop ? " landing-scroll-top--visible" : ""}`}
        aria-label="Back to top"
        onClick={scrollTop}
      >
        <ChevronUp size={22} strokeWidth={2.5} aria-hidden />
      </button>

      <aside
        className={`landing-mobile-cta-bar${showCtaBar ? "" : " landing-mobile-cta-bar--hidden"}`}
        aria-label="Quick actions"
        aria-hidden={!showCtaBar}
      >
        <Link to="/login" className="btn btn-p landing-btn-glow landing-mobile-cta-bar__primary" {...loginLinkPrefetchProps}>
          Start evaluation →
        </Link>
        <a href="#pricing" className="landing-mobile-cta-bar__secondary">
          Plans
        </a>
      </aside>
    </>
  );
}
