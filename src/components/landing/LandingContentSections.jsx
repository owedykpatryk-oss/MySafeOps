import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loginLinkPrefetchProps, prefetchLoginPage } from "../../utils/routePrefetch";
import LandingBlogSection from "./LandingBlogSection";

const LandingFaqSection = lazy(() => import("./LandingFaqSection"));

function FaqSuspenseFallback() {
  return (
    <section className="landing-faq" id="faq" aria-busy="true" aria-label="Loading FAQ">
      <div className="ctn">
        <div className="sh">
          <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
            FAQ
          </div>
          <h2 style={{ marginTop: 12, marginBottom: 8 }}>Common questions</h2>
          <p style={{ color: "var(--sl6)" }}>Loading answers…</p>
        </div>
        <div className="landing-faq-list">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid rgba(226,232,240,.95)",
                borderRadius: "var(--landing-radius)",
                background: "var(--w)",
                padding: "18px 20px",
                minHeight: 60,
              }}
            >
              <div className="landing-faq-skeleton-line landing-faq-skeleton-line--lg" style={{ marginBottom: 10 }} />
              <div className="landing-faq-skeleton-line" style={{ marginBottom: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { emoji: "⚠️", bg: "rgba(13,148,136,.1)", t: "RAMS Builder", d: "Clickable risk matrix, hazard suggestions, and method statements. Keep RAMS consistent and easy to review." },
  { emoji: "🔥", bg: "rgba(249,115,22,.1)", t: "Permits to Work", d: "Hot work, height, confined space, electrical, excavation, lifting, and more — with live/expired visibility." },
  { emoji: "🚨", bg: "rgba(239,68,68,.1)", t: "Incident Reporting", d: "Near misses, injuries, RIDDOR paths. Capture evidence fast and keep follow-up visible." },
  { emoji: "👷", bg: "rgba(59,130,246,.1)", t: "Worker competency", d: "Certificates, training matrix, and expiry awareness — so skills stay current on site." },
  { emoji: "📊", bg: "rgba(139,92,246,.1)", t: "Operational visibility", d: "Dashboards and registers that help supervisors spot gaps before they become incidents." },
  { emoji: "🗺️", bg: "rgba(34,197,94,.1)", t: "Site plans & photos", d: "Mark hazards, assembly points, and exclusions — with evidence that is easy to find later." },
  { emoji: "📚", bg: "rgba(6,182,212,.1)", t: "Registers & logs", d: "COSHH, fire, waste, visitors, inspections — structured records without spreadsheet chaos." },
  { emoji: "✅", bg: "rgba(120,113,108,.1)", t: "Inspection checklists", d: "Pre-starts, weekly checks, equipment inspections — tick, note, and evidence in one flow." },
  { emoji: "🚗", bg: "rgba(168,85,247,.1)", t: "Vehicle & equipment", d: "Track inspections, calibration, and key dates with reminders before things slip." },
];

const MODULE_TICKER = [
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
];

const READINESS_SIGNALS = [
  { id: "permits-live", title: "Live permit status", detail: "You can instantly spot active, expiring, and overdue permits." },
  { id: "daily-briefing", title: "Daily briefing trail", detail: "Toolbox talks and briefings are signed and easy to evidence." },
  { id: "competency-watch", title: "Competency expiry watch", detail: "Workers with expiring certs are flagged before deployment." },
  { id: "incident-speed", title: "Incident capture speed", detail: "Near misses are logged with photos in under 2 minutes." },
  { id: "audit-ready", title: "Audit-ready exports", detail: "You can export clear records without spreadsheet rework." },
];

function getReadinessTone(score) {
  if (score >= 80) return { label: "Site ready", hint: "Strong baseline. Keep checks consistent across shifts." };
  if (score >= 60) return { label: "Good baseline", hint: "You are close. Tighten the missing checks to reduce risk." };
  if (score >= 40) return { label: "Needs attention", hint: "Some controls are inconsistent and could expose the site." };
  return { label: "High exposure", hint: "Critical controls are not stable yet. Prioritize the basics first." };
}

function ReadinessCheckSection() {
  const [selected, setSelected] = useState(["permits-live", "daily-briefing"]);
  const score = useMemo(() => Math.round((selected.length / READINESS_SIGNALS.length) * 100), [selected.length]);
  const missing = READINESS_SIGNALS.length - selected.length;
  const tone = getReadinessTone(score);

  const toggleSignal = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <section className="wow-check" id="readiness">
      <div className="ctn">
        <div className="wow-shell fu">
          <div>
            <div className="badge wow-badge">2-minute check</div>
            <h2>How ready is your site today?</h2>
            <p className="wow-copy">
              Toggle what is already in place and see your live readiness score. Teams use this to quickly spot where risk still leaks.
            </p>
            <div className="wow-list" role="group" aria-label="Readiness checklist">
              {READINESS_SIGNALS.map((item) => {
                const active = selected.includes(item.id);
                return (
                  <button key={item.id} type="button" className="wow-item" data-active={active} onClick={() => toggleSignal(item.id)}>
                    <span className="wow-checkmark" aria-hidden>
                      {active ? "✓" : "○"}
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="wow-panel" aria-live="polite">
            <div className="wow-ring" style={{ "--score": `${score}%` }}>
              <div className="wow-ring-inner">
                <strong>{score}%</strong>
                <span>Readiness</span>
              </div>
            </div>
            <p className="wow-state">{tone.label}</p>
            <p className="wow-hint">{tone.hint}</p>
            <p className="wow-risk">
              {missing === 0
                ? "No obvious gaps selected — great baseline for the day."
                : `${missing} key area${missing > 1 ? "s are" : " is"} still weak. Fixing them first usually cuts rework and surprises.`}
            </p>
            <Link to="/login" className="btn btn-p" {...loginLinkPrefetchProps}>
              Unlock full readiness dashboard
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

function formatGBP(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function RoiEstimatorSection() {
  const [teamSize, setTeamSize] = useState(8);
  const [dailyDocs, setDailyDocs] = useState(5);
  const [minutesSaved, setMinutesSaved] = useState(10);
  const [hourlyRate, setHourlyRate] = useState(28);

  const { weeklyHours, monthlyValue } = useMemo(() => {
    const weeklyMinutes = teamSize * dailyDocs * minutesSaved * 5;
    const hours = weeklyMinutes / 60;
    const month = hours * 4.33 * hourlyRate;
    return {
      weeklyHours: hours,
      monthlyValue: month,
    };
  }, [teamSize, dailyDocs, minutesSaved, hourlyRate]);

  return (
    <section className="roi" id="roi">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(249,115,22,.12)", color: "var(--org-d)" }}>
            Value estimate
          </div>
          <h2>What is paperwork delay costing you?</h2>
          <p>
            Quick estimate only. Adjust a few numbers and see potential time and cost recovered when site documentation is handled in one flow.
          </p>
        </div>

        <div className="roi-grid fu">
          <div className="roi-controls">
            <label>
              Team members on active site
              <input type="range" min={2} max={40} value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} />
              <strong>{teamSize} people</strong>
            </label>
            <label>
              Docs/permits touched per person daily
              <input type="range" min={1} max={12} value={dailyDocs} onChange={(e) => setDailyDocs(Number(e.target.value))} />
              <strong>{dailyDocs} items/day</strong>
            </label>
            <label>
              Minutes saved per item
              <input type="range" min={3} max={20} value={minutesSaved} onChange={(e) => setMinutesSaved(Number(e.target.value))} />
              <strong>{minutesSaved} min</strong>
            </label>
            <label>
              Blended labour rate
              <input type="range" min={16} max={65} value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} />
              <strong>{formatGBP(hourlyRate)}/hour</strong>
            </label>
          </div>

          <aside className="roi-result">
            <p className="roi-kicker">Potential recovery</p>
            <div className="roi-big">{weeklyHours.toFixed(1)} hrs / week</div>
            <div className="roi-sub">~ {formatGBP(monthlyValue)} / month in productive time</div>
            <p>
              Estimation assumes steady activity over 5 working days. Use this as a planning baseline, not as a guaranteed financial forecast.
            </p>
            <p style={{ fontSize: 13, color: "var(--sl5)", marginTop: 12, lineHeight: 1.5 }}>
              Subscription is priced <strong>per organisation</strong> (tier caps), not per worker seat — compare with the{" "}
              <a href="#pricing" style={{ color: "var(--teal)", fontWeight: 600 }}>
                pricing table
              </a>
              .
            </p>
            <Link to="/login" className="btn btn-p" {...loginLinkPrefetchProps}>
              Test this in your workspace
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function LandingContentSections({ supportEmail, featureForm, onChangeFeature, onSubmitFeature, ctaEmail, onCtaEmailChange, onCtaGo }) {
  return (
    <>
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
            {FEATURES.map((x) => (
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

      <ReadinessCheckSection />

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
              <div className="rp"><span className="y">✓</span> Organisation settings & backups</div>
              <div className="rp"><span className="y">✓</span> Invite users and manage roles</div>
              <div className="rp"><span className="y">✓</span> Approve key documents and exports</div>
              <div className="rp"><span className="y">✓</span> Full module access (per plan)</div>
            </div>
            <div className="rc feat-r fu">
              <h3>🔧 Supervisor</h3>
              <div className="rsub">Site leads & foremen</div>
              <div className="rp"><span className="y">✓</span> Run permits, briefings, inspections</div>
              <div className="rp"><span className="y">✓</span> Toolbox talks and site records</div>
              <div className="rp"><span className="y">✓</span> Report incidents and near misses</div>
              <div className="rp"><span className="v">👁</span> Practical day-to-day control</div>
            </div>
            <div className="rc fu">
              <h3>👷 Worker</h3>
              <div className="rsub" style={{ color: "var(--teal)", fontWeight: 700 }}>Operative access</div>
              <div className="rp"><span className="v">👁</span> Read and acknowledge RAMS where required</div>
              <div className="rp"><span className="y">✓</span> Sign attendance and complete induction steps</div>
              <div className="rp"><span className="y">✓</span> Report issues with photos and context</div>
              <div className="rp"><span className="n">—</span> No admin billing or org settings</div>
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
          {MODULE_TICKER.flatMap((t) => [t, t]).map((label, i) => (
            <div key={`${label}-${i}`} className="mg">{label}</div>
          ))}
        </div>
      </section>

      <section className="pricing" id="pricing" aria-labelledby="pricing-heading">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(249,115,22,.1)", color: "var(--org)" }}>Pricing</div>
            <h2 id="pricing-heading">Plans that stay transparent</h2>
            <p>Flat organisation pricing — not per seat. Live limits and usage are in the app under Settings → Billing & limits.</p>
          </div>
          <div className="prc">
            <div className="pcard fu">
              <h3>Free</h3><div className="pr">£0</div><div className="yr">5 workers · 2 projects</div><div className="wf">👷 Try before you buy</div>
              <ul><li>Core RAMS &amp; permits</li><li>500MB cloud backup cap</li><li>Offline-first</li></ul>
              <Link
                to="/login"
                className="btn btn-o"
                style={{ width: "100%", justifyContent: "center", fontSize: 14 }}
                {...loginLinkPrefetchProps}
              >
                Open app
              </Link>
            </div>
            <div className="pcard fu">
              <h3>Solo</h3><div className="pr">£29<span>/mo</span></div><div className="yr">5 workers · 3 projects · 2GB</div><div className="wf">👷 Freelancer / single site</div>
              <ul><li>All safety modules</li><li>Cloud backup (when configured)</li><li>Email support</li></ul>
              <Link
                to="/login"
                className="btn btn-o"
                style={{ width: "100%", justifyContent: "center", fontSize: 14 }}
                {...loginLinkPrefetchProps}
              >
                Start trial
              </Link>
            </div>
            <div className="pcard pop fu">
              <h3>Team</h3><div className="pr">£79<span>/mo</span></div><div className="yr">20 workers · 10 projects · 10GB</div><div className="wf">👷 Small contractor</div>
              <ul><li>Industrial Sector Pack</li><li>Invites &amp; role management</li><li>Priority support</li><li className="free">Multi-supervisor sites</li></ul>
              <Link
                to="/login"
                className="btn btn-p"
                style={{ width: "100%", justifyContent: "center", fontSize: 14 }}
                {...loginLinkPrefetchProps}
              >
                Start trial
              </Link>
            </div>
            <div className="pcard fu">
              <h3>Business</h3><div className="pr">£149<span>/mo</span></div><div className="yr">75 workers · 40 projects · 50GB</div><div className="wf">👷 Multi-site governance</div>
              <ul><li>Tamper-evident audit log</li><li>Dedicated onboarding</li><li>Higher operational headroom</li></ul>
              <Link
                to="/login"
                className="btn btn-o"
                style={{ width: "100%", justifyContent: "center", fontSize: 14 }}
                {...loginLinkPrefetchProps}
              >
                Start trial
              </Link>
            </div>
            <div className="pcard fu">
              <h3>Enterprise</h3><div className="pr">£399<span>/mo</span></div><div className="yr">150 workers · 80 projects · 200GB</div><div className="wf">👷 Group operations</div>
              <ul><li>Custom subdomain</li><li>Group MI dashboard</li><li>SLA &amp; named support</li></ul>
              <Link
                to="/login"
                className="btn btn-o"
                style={{ width: "100%", justifyContent: "center", fontSize: 14 }}
                {...loginLinkPrefetchProps}
              >
                Start trial
              </Link>
            </div>
            <div className="pcard fu">
              <h3>Enterprise Plus</h3><div className="pr" style={{ fontSize: 28 }}>Let&apos;s talk</div><div className="yr">150+ people · custom SLA</div><div className="wf">👷 Post-acquisition scale</div>
              <ul><li>Unlimited workers &amp; projects</li><li>Custom integrations</li><li>Dedicated account manager</li></ul>
              <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent("MySafeOps Enterprise Plus")}`}
                className="btn btn-o"
                style={{ width: "100%", justifyContent: "center", fontSize: 14 }}
              >
                Contact sales
              </a>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--sl4)", marginTop: 24 }}>
            Includes a 14-day trial in-product when you sign in (where enabled). Not legal advice — always follow your site rules and UK requirements.
          </p>
        </div>
      </section>

      <RoiEstimatorSection />

      <LandingBlogSection />

      <Suspense fallback={<FaqSuspenseFallback />}>
        <LandingFaqSection />
      </Suspense>

      <section className="missing" id="missing">
        <div className="ctn">
          <h2>🛠️ Missing something?</h2>
          <p>We build MySafeOps for real site workflows — tell us what register, checklist, or workflow you need next.</p>
          <div className="sub">
            If it matters on site, it belongs on the roadmap — email us a short brief and we will triage it. <strong style={{ color: "var(--w)" }}>Support: {supportEmail}</strong>
          </div>
          <div className="mf">
            <input type="email" placeholder="Your email" value={featureForm.email} onChange={(e) => onChangeFeature("email", e.target.value)} autoComplete="email" />
            <input type="text" placeholder="Your name / company" value={featureForm.name} onChange={(e) => onChangeFeature("name", e.target.value)} />
          </div>
          <div className="mf">
            <textarea placeholder="What feature, register, or document type do you need?" value={featureForm.desc} onChange={(e) => onChangeFeature("desc", e.target.value)} rows={4} />
          </div>
          <div className="mf">
            <button type="button" className="btn btn-p" onClick={onSubmitFeature}>Email feature request →</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--sl6)", marginTop: 8, position: "relative" }}>Opens your email app with a pre-filled message to {supportEmail}.</p>
        </div>
      </section>

      <section className="comp" id="compliance">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>UK-focused</div>
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
                <div key={h4} className="ci"><div className="ck">✓</div><div><h4>{h4}</h4><p>{p}</p></div></div>
              ))}
            </div>
            <div className="cm fu"><div className="bs">UK</div></div>
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
              onChange={(e) => onCtaEmailChange(e.target.value)}
              onFocus={prefetchLoginPage}
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
            <button type="button" className="btn btn-p" onMouseEnter={prefetchLoginPage} onFocus={prefetchLoginPage} onClick={onCtaGo}>
              Continue to sign in →
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--sl6)", marginTop: 16, position: "relative" }}>
            Help: <a href={`mailto:${supportEmail}`} style={{ color: "var(--teal-l)" }}>{supportEmail}</a>
          </p>
        </div>
      </section>
    </>
  );
}
