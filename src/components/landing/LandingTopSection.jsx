import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#modules", label: "Modules" },
  { href: "#readiness", label: "Readiness check" },
  { href: "#roi", label: "Value" },
  { href: "#roles", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog", spa: true },
  { href: "#faq", label: "FAQ" },
  { href: "#missing", label: "Request feature" },
];

export default function LandingTopSection({ navScrolled, cloud }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      <nav className={`landing-top-nav${navScrolled ? " sc" : ""}`} aria-label="Primary">
        <div className="ctn">
          <div className="ni">
            <Link to="/" className="logo">
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
            </Link>
            <div className="nl">
              {NAV_LINKS.map((item) =>
                item.spa ? (
                  <Link key={item.href} to={item.href}>
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                )
              )}
              <Link to="/login" className="btn btn-o nc" {...loginLinkPrefetchProps}>
                Sign in
              </Link>
              <Link to="/login" className="btn btn-p nc" {...loginLinkPrefetchProps}>
                Get started
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
              {NAV_LINKS.map((item) =>
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
                to="/login"
                className="landing-mobile-cta"
                {...loginLinkPrefetchProps}
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/login"
                className="landing-mobile-cta landing-mobile-cta-primary"
                {...loginLinkPrefetchProps}
                onClick={() => setMobileOpen(false)}
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="hero" aria-labelledby="landing-hero-heading">
        <div className="ctn">
          <div className="hg">
            <div>
              <div className="badge hb">🏗️ Built for UK Construction</div>
              <h1 id="landing-hero-heading">
                Site safety,
                <br />
                <span className="hl">simplified.</span>
              </h1>
              <p>
                RAMS, Permits to Work, inspections, worker competency — all managed from your phone. UK-focused workflows for construction teams.{" "}
                {cloud ? "Cloud sign-in and backup are enabled for this deployment." : "Add Supabase in your environment for optional cloud backup."}
              </p>
              <div className="hbs">
                <Link to="/login" className="btn btn-p" {...loginLinkPrefetchProps}>
                  Get started →
                </Link>
                <a href="#readiness" className="btn btn-o">
                  Run 2-min check
                </a>
                <a href="#pricing" className="btn btn-o">
                  View pricing
                </a>
              </div>
              <div className="landing-trust-strip" role="note">
                <span>Offline-capable core</span>
                <span className="landing-trust-dot" aria-hidden>
                  ·
                </span>
                <span>UK-oriented copy &amp; registers</span>
                <span className="landing-trust-dot" aria-hidden>
                  ·
                </span>
                <span>Flat org pricing — not per seat</span>
                <span className="landing-trust-dot" aria-hidden>
                  ·
                </span>
                <span>Optional Supabase backup</span>
              </div>
              <div className="hs" aria-label="Product highlights">
                <div>
                  <strong>14+</strong>
                  <span>Document Types</span>
                </div>
                <div>
                  <strong>7</strong>
                  <span>Permit Types</span>
                </div>
                <div>
                  <strong>30+</strong>
                  <span>Trade Libraries</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>Browser-first</span>
                </div>
              </div>
            </div>
            <div className="pw">
              <div className="pg" aria-hidden />
              <div className="ph" role="img" aria-label="Example MySafeOps dashboard preview (illustration)">
                <div className="ps">
                  <div className="phd">
                    <div className="pl">⚙️ MySafeOps</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316" }} />
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sl4)" }} />
                    </div>
                  </div>
                  <div className="pb">
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>📊 Dashboard</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #f97316" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>12</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>RAMS</div>
                      </div>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #a78bfa" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>8</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>Permits</div>
                      </div>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #ef4444" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>2</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>Incidents</div>
                      </div>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, textAlign: "center", borderLeft: "3px solid #06b6d4" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>24</div>
                        <div style={{ fontSize: 7, color: "#64748b" }}>Workers</div>
                      </div>
                    </div>
                    <div className="pc">
                      <div className="pct">⚠️ RAMS — Welding/Hot Works</div>
                      <div className="pcs">RAMS-003 · Zone B · Approved ✅</div>
                      <div className="pcb">
                        <div style={{ width: "95%", background: "#22c55e" }} />
                      </div>
                    </div>
                    <div className="pc" style={{ borderLeftColor: "#3b82f6" }}>
                      <div className="pct" style={{ color: "#3b82f6" }}>
                        🏗️ Height PTW — Roof Access
                      </div>
                      <div className="pcs">PTW-007 · 6h remaining</div>
                      <div className="pcb">
                        <div style={{ width: "70%", background: "#3b82f6" }} />
                      </div>
                    </div>
                    <div className="pc" style={{ borderLeftColor: "#ef4444" }}>
                      <div className="pct" style={{ color: "#ef4444" }}>
                        🚨 Near Miss Reported
                      </div>
                      <div className="pcs">INC-004 · Zone C · Pending review</div>
                      <div className="pcb">
                        <div style={{ width: "40%", background: "#eab308" }} />
                      </div>
                    </div>
                  </div>
                  <div className="pn">
                    <div>
                      <span>📊</span>Home
                    </div>
                    <div style={{ color: "#f97316" }}>
                      <span>📄</span>Docs
                    </div>
                    <div>
                      <span>👷</span>Workers
                    </div>
                    <div>
                      <span>🔧</span>Equip
                    </div>
                    <div>
                      <span>⚙️</span>More
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
