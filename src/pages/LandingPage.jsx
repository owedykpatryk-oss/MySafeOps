import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import "../styles/landing.css";
import LandingTopSection from "../components/landing/LandingTopSection";
import LandingContentSections from "../components/landing/LandingContentSections";
import LandingFooter from "../components/landing/LandingFooter";

const SUPPORT_EMAIL = "mysafeops@gmail.com";

export default function LandingPage() {
  const cloud = isSupabaseConfigured();
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
    const els = document.querySelectorAll(".landing-page .fu");
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

  return (
    <div className="landing-page">
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
    </div>
  );
}
