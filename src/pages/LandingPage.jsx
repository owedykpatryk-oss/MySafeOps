import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { scheduleIdleLoginPrefetch } from "../utils/routePrefetch";
import "../styles/landing.css";
import LandingTopSection from "../components/landing/LandingTopSection";
import LandingContentSections from "../components/landing/LandingContentSections";
import LandingFooter from "../components/landing/LandingFooter";
import { useLandingHomeDocumentMeta } from "../utils/landingPageMeta";

const SUPPORT_EMAIL = "mysafeops@gmail.com";
const LANDING_TITLE = "MySafeOps — RAMS, permits & site safety for UK construction";
const LANDING_DESCRIPTION =
  "RAMS builder, permits to work, inspections, worker competency, and 40+ registers — browser-first for UK construction teams. Optional cloud sign-in and backup.";

export default function LandingPage() {
  const cloud = isSupabaseConfigured();
  const { user, ready, loading } = useSupabaseAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const [featureForm, setFeatureForm] = useState({ email: "", name: "", desc: "" });
  const [ctaEmail, setCtaEmail] = useState("");

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (cloud && (!ready || loading)) return undefined;
    if (cloud && ready && user) return undefined;
    return scheduleIdleLoginPrefetch();
  }, [cloud, ready, loading, user]);

  /** Warm blog route chunks so first click from the marketing page loads quickly. */
  useEffect(() => {
    void import("./BlogIndexPage.jsx");
    void import("./BlogArticlePage.jsx");
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
      // threshold 0: reveal as soon as any pixel is visible; rootMargin nudges “near viewport” items
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

    /** One-shot fallback if IO fires late on first paint (keeps .fu from staying opacity:0). */
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

    // Lazy-loaded sections append new `.fu` nodes after first paint.
    // Observe those nodes too so they don't stay invisible.
    const mutationObs = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) observeFadeUpTargets(node);
        });
      });
    });
    mutationObs.observe(root, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      mutationObs.disconnect();
    };
  }, []);

  const landingJsonLd = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "MySafeOps",
      url: origin,
      description: LANDING_DESCRIPTION,
      publisher: {
        "@type": "Organization",
        name: "MySafeOps",
        url: origin,
        email: SUPPORT_EMAIL,
      },
    };
  }, []);

  useLandingHomeDocumentMeta({
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    jsonLd: landingJsonLd,
  });

  const submitFeature = () => {
    const email = featureForm.email.trim();
    const name = featureForm.name.trim();
    const desc = featureForm.desc.trim();
    if (!email || !desc) {
      window.alert("Please enter your email and describe the feature you need.");
      return;
    }
    const subject = encodeURIComponent("MySafeOps feature request");
    const body = encodeURIComponent(`Name / company: ${name || "(not provided)"}\nEmail: ${email}\n\n${desc}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const ctaGo = () => {
    const q = ctaEmail.trim() ? `?email=${encodeURIComponent(ctaEmail.trim())}` : "";
    window.location.assign(`/login${q}`);
  };

  if (cloud && (!ready || loading)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans, system-ui, sans-serif",
          gap: 12,
          background: "#f8fafc",
        }}
      >
        <div className="app-route-spinner" aria-hidden />
        <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  if (cloud && ready && user) {
    return <Navigate to="/app?view=dashboard" replace />;
  }

  return (
    <div className="landing-page">
      <a href="#landing-main" className="landing-skip-link">
        Skip to main content
      </a>
      <main id="landing-main" tabIndex={-1}>
        <LandingTopSection navScrolled={navScrolled} cloud={cloud} />
        <LandingContentSections
          supportEmail={SUPPORT_EMAIL}
          featureForm={featureForm}
          onChangeFeature={(k, v) => setFeatureForm((f) => ({ ...f, [k]: v }))}
          onSubmitFeature={submitFeature}
          ctaEmail={ctaEmail}
          onCtaEmailChange={setCtaEmail}
          onCtaGo={ctaGo}
        />
        <LandingFooter supportEmail={SUPPORT_EMAIL} />
      </main>
    </div>
  );
}
