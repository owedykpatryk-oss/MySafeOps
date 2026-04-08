import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import "../styles/landing.css";

const SUPPORT_EMAIL = "mysafeops@gmail.com";

export default function LandingPage() {
  const cloud = isSupabaseConfigured();
  const [navScrolled, setNavScrolled] = useState(false);
  const [featEmail, setFeatEmail] = useState("");
  const [featName, setFeatName] = useState("");
  const [featDesc, setFeatDesc] = useState("");
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
    const email = featEmail.trim();
    const name = featName.trim();
    const desc = featDesc.trim();
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
      <nav className={navScrolled ? "sc" : ""}>
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
              <a href="#features">Features</a>
              <a href="#roles">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#missing">Request Feature</a>
              <Link to="/login" className="btn btn-p nc">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="ctn">
          <div className="hg">
            <div>
              <div className="badge hb">🏗️ Built for UK Construction</div>
              <h1>
                Site safety,
                <br />
                <span className="hl">simplified.</span>
              </h1>
              <p>
                RAMS, Permits to Work, inspections, worker competency — all managed from your phone. UK-focused workflows for construction teams.{" "}
                {cloud ? "Cloud sign-in and backup are enabled for this deployment." : "Add Supabase in your environment for optional cloud backup."}
              </p>
              <div className="hbs">
                <Link to="/login" className="btn btn-p">
                  Get started →
                </Link>
                <a href="#features" className="btn btn-o">
                  See Features
                </a>
              </div>
              <div className="hs">
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
              <div className="pg" />
              <div className="ph">
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

      <section className="feat" id="features">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
              Features
            </div>
            <h2>Everything you need on site</h2>
            <p>From risk assessments to permit management, worker competency to equipment tracking — one app replaces scattered paperwork.</p>
          </div>
          <div className="fg">
            {[
              { emoji: "⚠️", bg: "rgba(13,148,136,.1)", t: "RAMS Builder", d: "Clickable risk matrix, hazard suggestions, and method statements. Keep RAMS consistent and easy to review." },
              { emoji: "🔥", bg: "rgba(249,115,22,.1)", t: "Permits to Work", d: "Hot work, height, confined space, electrical, excavation, lifting, and more — with live/expired visibility." },
              { emoji: "🚨", bg: "rgba(239,68,68,.1)", t: "Incident Reporting", d: "Near misses, injuries, RIDDOR paths. Capture evidence fast and keep follow-up visible." },
              { emoji: "👷", bg: "rgba(59,130,246,.1)", t: "Worker competency", d: "Certificates, training matrix, and expiry awareness — so skills stay current on site." },
              { emoji: "📊", bg: "rgba(139,92,246,.1)", t: "Operational visibility", d: "Dashboards and registers that help supervisors spot gaps before they become incidents." },
              { emoji: "🗺️", bg: "rgba(34,197,94,.1)", t: "Site plans & photos", d: "Mark hazards, assembly points, and exclusions — with evidence that is easy to find later." },
              { emoji: "📚", bg: "rgba(6,182,212,.1)", t: "Registers & logs", d: "COSHH, fire, waste, visitors, inspections — structured records without spreadsheet chaos." },
              { emoji: "✅", bg: "rgba(120,113,108,.1)", t: "Inspection checklists", d: "Pre-starts, weekly checks, equipment inspections — tick, note, and evidence in one flow." },
              { emoji: "🚗", bg: "rgba(168,85,247,.1)", t: "Vehicle & equipment", d: "Track inspections, calibration, and key dates with reminders before things slip." },
            ].map((x) => (
              <div key={x.t} className="fc fu">
                <div className="fi" style={{ background: x.bg }}>
                  {x.emoji}
                </div>
                <h3>{x.t}</h3>
                <p>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="roles" id="roles">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(249,115,22,.1)", color: "var(--org)" }}>
              How it works
            </div>
            <h2>One app, three roles</h2>
            <p>Everyone uses the same workspace. Permissions keep admins, supervisors, and workers in their lane.</p>
          </div>
          <div className="rg">
            <div className="rc fu">
              <h3>👑 Admin</h3>
              <div className="rsub">Managers & office staff</div>
              <div className="rp">
                <span className="y">✓</span> Organisation settings & backups
              </div>
              <div className="rp">
                <span className="y">✓</span> Invite users and manage roles
              </div>
              <div className="rp">
                <span className="y">✓</span> Approve key documents and exports
              </div>
              <div className="rp">
                <span className="y">✓</span> Full module access (per plan)
              </div>
            </div>
            <div className="rc feat-r fu">
              <h3>🔧 Supervisor</h3>
              <div className="rsub">Site leads & foremen</div>
              <div className="rp">
                <span className="y">✓</span> Run permits, briefings, inspections
              </div>
              <div className="rp">
                <span className="y">✓</span> Toolbox talks and site records
              </div>
              <div className="rp">
                <span className="y">✓</span> Report incidents and near misses
              </div>
              <div className="rp">
                <span className="v">👁</span> Practical day-to-day control
              </div>
            </div>
            <div className="rc fu">
              <h3>👷 Worker</h3>
              <div className="rsub" style={{ color: "var(--teal)", fontWeight: 700 }}>
                Operative access
              </div>
              <div className="rp">
                <span className="v">👁</span> Read and acknowledge RAMS where required
              </div>
              <div className="rp">
                <span className="y">✓</span> Sign attendance and complete induction steps
              </div>
              <div className="rp">
                <span className="y">✓</span> Report issues with photos and context
              </div>
              <div className="rp">
                <span className="n">—</span> No admin billing or org settings
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mods" id="modules">
        <div className="ctn">
          <h2>40+ modules. One app.</h2>
          <p>Registers, checklists, and workflows you can grow into — without bolting on five different tools.</p>
        </div>
        <div className="mt" aria-hidden>
          {[
            "⚠️ RAMS",
            "🔥 Hot Work Permits",
            "🏗️ Height Permits",
            "⛑️ Confined Space",
            "⚡ Electrical PTW",
            "⛏️ Excavation PTW",
            "🏋️ Lifting PTW",
            "📋 Site Reports",
            "🚨 Incidents",
            "☠️ COSHH",
            "🪜 Scaffold Register",
            "🏋️ LOLER",
            "🔥 Fire Log",
            "♻️ Waste Register",
            "🧑‍💼 Visitors",
            "✅ Checklists",
            "📊 Training Matrix",
            "🗺️ Site Plans",
            "📸 Evidence",
            "🚗 Vehicles",
            "🔧 Equipment",
            "🖨️ PDF Export",
          ]
            .flatMap((t) => [t, t])
            .map((label, i) => (
              <div key={`${label}-${i}`} className="mg">
                {label}
              </div>
            ))}
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(249,115,22,.1)", color: "var(--org)" }}>
              Pricing
            </div>
            <h2>Plans that stay transparent</h2>
            <p>Marketing examples below — your live limits and usage appear in the app under Settings → Billing & limits.</p>
          </div>
          <div className="prc">
            <div className="pcard fu">
              <h3>Free</h3>
              <div className="pr">
                £0
              </div>
              <div className="yr">Evaluate locally</div>
              <div className="wf">👷 Great for demos</div>
              <ul>
                <li>Try core modules offline-first</li>
                <li>Explore RAMS and permits workflows</li>
                <li>Upgrade when you connect your team</li>
              </ul>
              <Link to="/login" className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>
                Open app
              </Link>
            </div>
            <div className="pcard fu">
              <h3>Solo</h3>
              <div className="pr">
                £19<span>/mo</span>
              </div>
              <div className="yr">Example pricing</div>
              <div className="wf">👷 For small teams</div>
              <ul>
                <li>Strong single-site workflows</li>
                <li>Cloud backup (when configured)</li>
                <li>Email-led support</li>
              </ul>
              <Link to="/login" className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>
                Start trial
              </Link>
            </div>
            <div className="pcard pop fu">
              <h3>Team</h3>
              <div className="pr">
                £49<span>/mo</span>
              </div>
              <div className="yr">Example pricing</div>
              <div className="wf">👷 Collaboration-first</div>
              <ul>
                <li>Higher limits for active sites</li>
                <li>Invites and role management</li>
                <li>Priority support options</li>
                <li className="free">Built for multi-supervisor sites</li>
              </ul>
              <Link to="/login" className="btn btn-p" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>
                Start trial
              </Link>
            </div>
            <div className="pcard fu">
              <h3>Business</h3>
              <div className="pr">
                £99<span>/mo</span>
              </div>
              <div className="yr">Example pricing</div>
              <div className="wf">👷 Scale & governance</div>
              <ul>
                <li>Higher caps and operational headroom</li>
                <li>Stronger backup and retention targets</li>
                <li>Talk to us for rollout planning</li>
              </ul>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("MySafeOps Business plan")}`} className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>
                Contact sales
              </a>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--sl4)", marginTop: 24 }}>
            Includes a 14-day trial in-product when you sign in (where enabled). Not legal advice — always follow your site rules and UK requirements.
          </p>
        </div>
      </section>

      <section className="missing" id="missing">
        <div className="ctn">
          <h2>🛠️ Missing something?</h2>
          <p>We build MySafeOps for real site workflows — tell us what register, checklist, or workflow you need next.</p>
          <div className="sub">
            If it matters on site, it belongs on the roadmap — email us a short brief and we will triage it. <strong style={{ color: "var(--w)" }}>Support: {SUPPORT_EMAIL}</strong>
          </div>
          <div className="mf">
            <input type="email" placeholder="Your email" value={featEmail} onChange={(e) => setFeatEmail(e.target.value)} autoComplete="email" />
            <input type="text" placeholder="Your name / company" value={featName} onChange={(e) => setFeatName(e.target.value)} />
          </div>
          <div className="mf">
            <textarea
              placeholder="What feature, register, or document type do you need?"
              value={featDesc}
              onChange={(e) => setFeatDesc(e.target.value)}
              rows={4}
            />
          </div>
          <div className="mf">
            <button type="button" className="btn btn-p" onClick={submitFeature}>
              Email feature request →
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--sl6)", marginTop: 8, position: "relative" }}>
            Opens your email app with a pre-filled message to {SUPPORT_EMAIL}.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginTop: 40, position: "relative" }}>
            {[
              { q: "“We need clearer permit handovers.”", a: "— Site team, UK" },
              { q: "“Can we standardise induction evidence?”", a: "— Supervisor, UK" },
              { q: "“Better near-miss follow-up visibility.”", a: "— H&S lead, UK" },
            ].map((x) => (
              <div key={x.q} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "16px 20px", maxWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--w)", marginBottom: 4 }}>🗣️ {x.q}</div>
                <div style={{ fontSize: 12, color: "var(--sl4)" }}>{x.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="comp" id="compliance">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
              UK-focused
            </div>
            <h2>Built for practical compliance evidence</h2>
            <p>Use MySafeOps to organise site safety records — not as a substitute for legal advice or statutory reporting obligations.</p>
          </div>
          <div className="cg">
            <div className="cl fu">
              {[
                ["CDM 2015", "Construction (Design & Management) Regulations — structured site records and responsibilities."],
                ["HASAWA 1974", "Health and Safety at Work Act — consistent day-to-day controls and evidence trails."],
                ["Work at height", "Plan controls, briefings, and inspections with traceable records."],
                ["Equipment & lifting", "Keep inspection discipline visible — PAT, plant, lifting accessories (as your workflows require)."],
                ["COSHH", "Manage substance records and practical controls alongside site activity."],
                ["RIDDOR", "Support timely internal reporting workflows — follow HSE guidance for statutory reporting."],
              ].map(([h4, p]) => (
                <div key={h4} className="ci">
                  <div className="ck">✓</div>
                  <div>
                    <h4>{h4}</h4>
                    <p>{p}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="cm fu">
              <div className="bs">UK</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta" id="cta">
        <div className="ctn">
          <h2>Ready to open your workspace?</h2>
          <p>Sign in to start your trial (where enabled) and invite your organisation.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
            <input
              type="email"
              placeholder="Work email (optional)"
              value={ctaEmail}
              onChange={(e) => setCtaEmail(e.target.value)}
              style={{
                padding: "14px 24px",
                borderRadius: "var(--r)",
                border: "2px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.06)",
                color: "var(--w)",
                fontSize: 16,
                width: 320,
                maxWidth: "100%",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button type="button" className="btn btn-p" onClick={ctaGo}>
              Continue to sign in →
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--sl6)", marginTop: 16, position: "relative" }}>
            Help: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--teal-l)" }}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </section>

      <footer>
        <div className="ctn">
          <div className="fgrid">
            <div className="fb">
              <div className="lt" style={{ fontSize: 18 }}>
                <span style={{ color: "var(--teal-l)" }}>My</span>
                <span style={{ color: "var(--w)" }}>Safe</span>
                <span style={{ color: "var(--org)" }}>Ops</span>
              </div>
              <p>Construction safety workspace for UK sites — RAMS, permits, registers, and evidence in one place.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#roles">How it works</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <a href="#missing">Request feature</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Resources</h4>
              <ul>
                <li>
                  <Link to="/login">Sign in</Link>
                </li>
                <li>
                  <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
                </li>
                <li>
                  <span style={{ cursor: "default", opacity: 0.7 }}>Documentation (coming soon)</span>
                </li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li>
                  <a href={`mailto:${SUPPORT_EMAIL}`}>Email us</a>
                </li>
                <li>
                  <span style={{ cursor: "default", opacity: 0.7 }}>Privacy & terms (coming soon)</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="fbot">
            <span>© {new Date().getFullYear()} MySafeOps</span>
            <span>Help: {SUPPORT_EMAIL}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
