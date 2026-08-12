import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isPasswordRecoveryPending } from "../lib/passwordRecovery";
import { getSupportEmail } from "../config/supportContact";
import { scheduleIdleLoginPrefetch } from "../utils/routePrefetch";
import "../styles/landing.css";
import LandingTopSection from "../components/landing/LandingTopSection";
import LandingContentSections from "../components/landing/LandingContentSections";
import LandingFooter from "../components/landing/LandingFooter";
import LandingMobileChrome from "../components/landing/LandingMobileChrome";
import { useLandingHomeDocumentMeta } from "../utils/landingPageMeta";
import { getMarket, getAlternateMarkets, resolveMarketId } from "../config/markets";
import { getLandingMarketContent, getLandingNavLinks } from "../data/landingMarketContent";
import { setStoredMarketId } from "../utils/marketPref";

const SUPPORT_EMAIL = getSupportEmail();

/**
 * @param {{ marketId?: import("../config/markets").MarketId }} props
 */
export default function LandingPage({ marketId = "uk" }) {
  const market = getMarket(marketId);
  const copy = getLandingMarketContent(market.id);
  const navUi = getLandingNavLinks(market.id);

  const cloud = isSupabaseConfigured();
  const { user, ready } = useSupabaseAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");

  useEffect(() => {
    setStoredMarketId(market.id);
  }, [market.id]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!cloud || !ready || user) return undefined;
    return scheduleIdleLoginPrefetch();
  }, [cloud, ready, user]);

  /** Warm blog route chunks when idle — skip on save-data connections. */
  useEffect(() => {
    const conn = typeof navigator !== "undefined" ? navigator.connection : null;
    if (conn?.saveData) return undefined;

    const warm = () => {
      void import("./BlogIndexPage.jsx");
      void import("./BlogArticlePage.jsx");
      void import("./SecurityPosturePage.jsx");
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }

    const t = window.setTimeout(warm, 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const root = document.querySelector(".landing-page");
    if (!root) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      root.querySelectorAll(".fu").forEach((el) => el.classList.add("vi"));
      return undefined;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("vi");
        });
      },
      { threshold: 0, rootMargin: "0px 0px 15% 0px" }
    );

    const observeFadeUpTargets = (scope) => {
      scope.querySelectorAll?.(".fu").forEach((el) => {
        if (!el.classList.contains("vi")) obs.observe(el);
      });
      if (scope.classList?.contains("fu") && !scope.classList.contains("vi")) {
        obs.observe(scope);
      }
    };

    const revealInViewport = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      root.querySelectorAll(".fu:not(.vi)").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) el.classList.add("vi");
      });
    };

    observeFadeUpTargets(root);
    revealInViewport();
    requestAnimationFrame(() => {
      revealInViewport();
    });
    const t1 = window.setTimeout(revealInViewport, 120);
    const t2 = window.setTimeout(revealInViewport, 450);

    const mutationObs = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) observeFadeUpTargets(node);
        });
      });
    });
    mutationObs.observe(root, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      obs.disconnect();
      mutationObs.disconnect();
    };
  }, []);

  const alternateLocales = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const self = {
      hreflang: market.locale,
      href: `${origin}${market.homePath === "/" ? "/" : market.homePath}`,
    };
    const alts = getAlternateMarkets(market.id).map((alt) => ({
      hreflang: alt.locale,
      href: `${origin}${alt.homePath === "/" ? "/" : alt.homePath}`,
    }));
    // Complete reciprocal cluster + x-default (UK home). Never use alternateMarketId alone.
    return [
      { hreflang: "x-default", href: `${origin}/` },
      self,
      ...alts,
    ];
  }, [market.id, market.locale, market.homePath]);

  const landingJsonLd = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const siteId = `${origin}${market.homePath}#website`;
    const orgId = `${origin}/#org`;
    const appId = `${origin}${market.homePath}#software`;
    const paidPlanIds = ["starter", "team", "business", "enterprise"];
    const highPrice = Math.max(
      ...paidPlanIds.map((id) => {
        const priceStr = copy.pricing[id]?.price || "";
        const digits = String(priceStr).replace(/\D/g, "");
        const n = parseInt(digits, 10);
        return Number.isFinite(n) ? n : 0;
      })
    );
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": siteId,
          name: "MySafeOps",
          url: `${origin}${market.homePath}`,
          inLanguage: market.locale,
          description: copy.description,
          publisher: { "@id": orgId },
        },
        {
          "@type": "Organization",
          "@id": orgId,
          name: "MySafeOps",
          url: origin || undefined,
          email: SUPPORT_EMAIL,
        },
        {
          "@type": "SoftwareApplication",
          "@id": appId,
          name: "MySafeOps",
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Construction safety software",
          operatingSystem: "Web browser",
          description: copy.description,
          inLanguage: market.locale,
          url: `${origin}${market.homePath}`,
          isAccessibleForFree: true,
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: market.currency,
            lowPrice: "0",
            highPrice: String(highPrice),
            offerCount: String(paidPlanIds.length + 1),
            availability: "https://schema.org/InStock",
            url: `${origin}${market.homePath}#pricing`,
          },
          publisher: { "@id": orgId },
        },
      ],
    };
  }, [market, copy]);

  const ogImageAbsoluteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/blog/images/permit-to-work-app-uk-hero.png`;
  }, []);

  useLandingHomeDocumentMeta({
    title: copy.title,
    description: copy.description,
    jsonLd: landingJsonLd,
    ogImageAbsoluteUrl: ogImageAbsoluteUrl || undefined,
    canonicalPath: market.homePath,
    locale: market.locale,
    ogLocale: market.ogLocale,
    ogImageAlt: copy.title,
    alternateLocales,
  });

  const ctaGo = () => {
    const params = new URLSearchParams();
    if (ctaEmail.trim()) params.set("email", ctaEmail.trim());
    if (market.id !== "uk") params.set("market", market.id);
    const q = params.toString();
    window.location.assign(`/login${q ? `?${q}` : ""}`);
  };

  // Recovery links often fall back to Site URL (`/`). Do not send those sessions into /app.
  if (cloud && ready && user && isPasswordRecoveryPending()) {
    return <Navigate to="/reset-password" replace />;
  }

  if (cloud && ready && user) {
    return <Navigate to="/app?view=dashboard" replace />;
  }

  return (
    <div className={`landing-page landing-page--${market.id}`}>
      <a href="#landing-main" className="landing-skip-link">
        {navUi.skipToMain}
      </a>
      <main id="landing-main" tabIndex={-1}>
        <LandingTopSection navScrolled={navScrolled} market={market} copy={copy} />
        <LandingContentSections
          market={market}
          copy={copy}
          supportEmail={SUPPORT_EMAIL}
          ctaEmail={ctaEmail}
          onCtaEmailChange={setCtaEmail}
          onCtaGo={ctaGo}
        />
        <LandingFooter supportEmail={SUPPORT_EMAIL} market={market} copy={copy} />
      </main>
      <LandingMobileChrome marketId={market.id} loginTo={market.loginPath} />
    </div>
  );
}

/** @param {{ marketId?: import("../config/markets").MarketId }} props */
export function AuLandingPage(props) {
  return <LandingPage marketId={resolveMarketId(props.marketId ?? "au")} />;
}

/** @param {{ marketId?: import("../config/markets").MarketId }} props */
export function PlLandingPage(props) {
  return <LandingPage marketId={resolveMarketId(props.marketId ?? "pl")} />;
}
