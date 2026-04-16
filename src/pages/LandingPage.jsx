import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import "../styles/landing.css";
import LandingTopSection from "../components/landing/LandingTopSection";
import LandingContentSections from "../components/landing/LandingContentSections";
import LandingFooter from "../components/landing/LandingFooter";

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
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll(".landing-page .fu");
    if (reduceMotion) {
      els.forEach((el) => el.classList.add("vi"));
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("vi");
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = LANDING_TITLE;
    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDescContent = metaDesc?.getAttribute("content") ?? "";
    if (metaDesc) metaDesc.setAttribute("content", LANDING_DESCRIPTION);

    let canonical = document.querySelector('link[rel="canonical"]');
    let canonicalCreated = false;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
      canonicalCreated = true;
    }
    const prevCanonical = canonical.getAttribute("href") || "";
    canonical.setAttribute("href", `${window.location.origin}/`);

    const origin = window.location.origin;
    const jsonLd = {
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
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-landing-ld", "1");
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      if (metaDesc) metaDesc.setAttribute("content", prevDescContent);
      if (canonicalCreated) canonical.remove();
      else if (prevCanonical) canonical.setAttribute("href", prevCanonical);
      else canonical.removeAttribute("href");
      document.querySelector('script[data-landing-ld="1"]')?.remove();
    };
  }, []);

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
