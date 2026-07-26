import { lazy, Suspense, useMemo, useState } from "react";
import { useCountUp } from "../../hooks/useCountUp";
import { Link } from "react-router-dom";
import { loginLinkPrefetchProps, prefetchLoginPage } from "../../utils/routePrefetch";
import { getPriceAdjustmentShort } from "../../lib/billingPlans";
import { getLandingFeatures, getModuleTicker } from "../../data/landingMarketContent";
import { getLandingSectionsCopy, getReadinessTone } from "../../data/landingSectionsCopy";
import LandingBlogSection from "./LandingBlogSection";
import LandingWorkflowBento from "./LandingWorkflowBento";

const LandingIndustryShowcase = lazy(() => import("./LandingIndustryShowcase"));
const LandingFaqSection = lazy(() => import("./LandingFaqSection"));

function IndustryShowcaseSuspenseFallback() {
  return (
    <section className="landing-industry" id="profiles" aria-busy="true" aria-label="Loading product profiles">
      <div className="ctn">
        <div className="sh">
          <h2 style={{ marginTop: 12 }}>Workspace profiles &amp; RAMS libraries</h2>
          <p style={{ color: "var(--sl6)" }}>Loading…</p>
        </div>
      </div>
    </section>
  );
}

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

const READINESS_SIGNALS_UK = [
  { id: "permits-live", title: "Live permit status", detail: "You can instantly spot active, expiring, and overdue permits." },
  { id: "daily-briefing", title: "Daily briefing trail", detail: "Toolbox talks and briefings are signed and easy to evidence." },
  { id: "competency-watch", title: "Competency expiry watch", detail: "Workers with expiring certs are flagged before deployment." },
  { id: "incident-speed", title: "Incident capture speed", detail: "Near misses are logged with photos in under 2 minutes." },
  { id: "audit-ready", title: "Audit-ready exports", detail: "You can export clear records without spreadsheet rework." },
];

function ReadinessCheckSection({ loginTo, marketId }) {
  const copy = getLandingSectionsCopy(marketId).readiness;
  const signals = copy.signals ?? READINESS_SIGNALS_UK;
  const [selected, setSelected] = useState(["permits-live", "daily-briefing"]);
  const score = useMemo(() => Math.round((selected.length / signals.length) * 100), [selected.length, signals.length]);
  const animatedScore = useCountUp(score);
  const missing = signals.length - selected.length;
  const tone = getReadinessTone(score, marketId);
  const complete = score === 100;

  const toggleSignal = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <section className="wow-check" id="readiness">
      <div className="ctn">
        <div className="wow-shell fu">
          <div>
            <div className="badge wow-badge">{copy.badge}</div>
            <h2>{copy.title}</h2>
            <p className="wow-copy">{copy.intro}</p>
            <div className="wow-list" role="group" aria-label="Readiness checklist">
              {signals.map((item) => {
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

          <aside className={`wow-panel${complete ? " wow-panel--celebrate" : ""}`} aria-live="polite">
            <div className={`wow-ring${complete ? " wow-ring--complete" : ""}`} style={{ "--score": `${score}%` }}>
              <div className="wow-ring-inner">
                <strong>{animatedScore}%</strong>
                <span>{copy.ringLabel}</span>
              </div>
            </div>
            <p className="wow-state">{tone.label}</p>
            <p className="wow-hint">{tone.hint}</p>
            <p className="wow-risk">
              {missing === 0 ? copy.noGaps : copy.gaps(missing)}
            </p>
            <Link to={loginTo} className="btn btn-p" {...loginLinkPrefetchProps}>
              {copy.unlockCta}
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

function formatCurrency(value, market) {
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function RoiEstimatorSection({ market, defaultRate, loginTo }) {
  const copy = getLandingSectionsCopy(market.id).roi;
  const [teamSize, setTeamSize] = useState(8);
  const [dailyDocs, setDailyDocs] = useState(5);
  const [minutesSaved, setMinutesSaved] = useState(10);
  const [hourlyRate, setHourlyRate] = useState(defaultRate);

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
            {copy.badge}
          </div>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>

        <div className="roi-grid fu">
          <div className="roi-controls">
            <label>
              {copy.teamLabel}
              <input type="range" min={2} max={40} value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} />
              <strong>{copy.people(teamSize)}</strong>
            </label>
            <label>
              {copy.docsLabel}
              <input type="range" min={1} max={12} value={dailyDocs} onChange={(e) => setDailyDocs(Number(e.target.value))} />
              <strong>{copy.itemsDay(dailyDocs)}</strong>
            </label>
            <label>
              {copy.minutesLabel}
              <input type="range" min={3} max={20} value={minutesSaved} onChange={(e) => setMinutesSaved(Number(e.target.value))} />
              <strong>{copy.min(minutesSaved)}</strong>
            </label>
            <label>
              {copy.rateLabel}
              <input type="range" min={16} max={65} value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} />
              <strong>{copy.hour(hourlyRate, formatCurrency(hourlyRate, market))}</strong>
            </label>
          </div>

          <aside className="roi-result">
            <p className="roi-kicker">{copy.kicker}</p>
            <div className="roi-big">{copy.week(weeklyHours.toFixed(1))}</div>
            <div className="roi-sub">{copy.month(monthlyValue, formatCurrency(monthlyValue, market))}</div>
            <p>{copy.disclaimer}</p>
            <p style={{ fontSize: 13, color: "var(--sl5)", marginTop: 12, lineHeight: 1.5 }}>
              {copy.orgPricing}{" "}
              <a href="#pricing" className="landing-touch-link" style={{ color: "var(--teal)", fontWeight: 600 }}>
                {copy.pricingLink}
              </a>
              .
            </p>
            <Link to={loginTo} className="btn btn-p" {...loginLinkPrefetchProps}>
              {copy.cta}
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function LandingContentSections({ market, copy, supportEmail, featureForm, onChangeFeature, onSubmitFeature, ctaEmail, onCtaEmailChange, onCtaGo }) {
  const loginTo = market.loginPath;
  const sections = getLandingSectionsCopy(market.id);
  const features = getLandingFeatures(market.id);
  const moduleTicker = getModuleTicker(market.id);
  const pricing = copy.pricing;

  return (
    <>
      <LandingWorkflowBento marketId={market.id} />

      <section className="feat" id="features">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>
              {sections.features.badge}
            </div>
            <h2>{sections.features.title}</h2>
            <p>{sections.features.intro}</p>
          </div>
          <div className="fg">
            {features.map((x, i) => (
              <div key={x.t} className="fc fu" style={{ transitionDelay: `${Math.min(i * 60, 360)}ms` }}>
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

      <Suspense fallback={<IndustryShowcaseSuspenseFallback />}>
        <LandingIndustryShowcase marketId={market.id} />
      </Suspense>

      <ReadinessCheckSection loginTo={loginTo} marketId={market.id} />

      <section className="roles" id="roles">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(249,115,22,.1)", color: "var(--org)" }}>
              {sections.roles.badge}
            </div>
            <h2>{sections.roles.title}</h2>
            <p>{sections.roles.intro}</p>
          </div>
          <div className="rg">
            <div className="rc fu">
              <h3>{sections.roles.admin.title}</h3>
              <div className="rsub">{sections.roles.admin.sub}</div>
              {sections.roles.admin.points.map((p) => (
                <div key={p} className="rp"><span className="y">✓</span> {p}</div>
              ))}
            </div>
            <div className="rc feat-r fu">
              <h3>{sections.roles.supervisor.title}</h3>
              <div className="rsub">{sections.roles.supervisor.sub}</div>
              {sections.roles.supervisor.points.map((p, i) => (
                <div key={p} className="rp">
                  <span className={i === sections.roles.supervisor.points.length - 1 ? "v" : "y"}>
                    {i === sections.roles.supervisor.points.length - 1 ? "👁" : "✓"}
                  </span>{" "}
                  {p}
                </div>
              ))}
            </div>
            <div className="rc fu">
              <h3>{sections.roles.worker.title}</h3>
              <div className="rsub" style={{ color: "var(--teal)", fontWeight: 700 }}>{sections.roles.worker.sub}</div>
              {sections.roles.worker.points.map((p, i) => {
                const marks = ["👁", "✓", "✓", "—"];
                const classes = ["v", "y", "y", "n"];
                return (
                  <div key={p} className="rp">
                    <span className={classes[i] ?? "y"}>{marks[i] ?? "✓"}</span> {p}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mods" id="modules">
        <div className="ctn">
          <h2>{sections.modules.title}</h2>
          <p>{sections.modules.intro}</p>
        </div>
        <div className="mt" aria-hidden>
          {moduleTicker.flatMap((t) => [t, t]).map((label, i) => (
            <div key={`${label}-${i}`} className="mg">{label}</div>
          ))}
        </div>
      </section>

      <section className="pricing" id="pricing" aria-labelledby="pricing-heading">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(249,115,22,.1)", color: "var(--org)" }}>{sections.pricing.badge}</div>
            <h2 id="pricing-heading">{sections.pricing.title}</h2>
            <p>{sections.pricing.intro}</p>
          </div>
          <div className="prc">
            <div className="pcard fu pop">
              <h3>{sections.pricing.evaluation}</h3><div className="pr">{pricing.trial.price}</div><div className="yr">{pricing.trial.subtitle}</div><div className="wf">{pricing.trial.tag}</div>
              <ul>{pricing.trial.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <Link to={loginTo} className="btn btn-p" style={{ width: "100%", justifyContent: "center", fontSize: 14 }} {...loginLinkPrefetchProps}>{sections.pricing.startEval}</Link>
            </div>
            <div className="pcard fu">
              <h3>{sections.pricing.solo}</h3><div className="pr">{pricing.starter.price}{pricing.starter.suffix && <span>{pricing.starter.suffix}</span>}</div><div className="yr">{pricing.starter.subtitle}</div><div className="wf">{pricing.starter.tag}</div>
              <ul>{pricing.starter.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <Link to={loginTo} className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }} {...loginLinkPrefetchProps}>{sections.pricing.startTrial}</Link>
            </div>
            <div className="pcard pop fu">
              <h3>{sections.pricing.team}</h3><div className="pr">{pricing.team.price}{pricing.team.suffix && <span>{pricing.team.suffix}</span>}</div><div className="yr">{pricing.team.subtitle}</div><div className="wf">{pricing.team.tag}</div>
              <ul>{pricing.team.features.map((f) => (f === "Multi-supervisor sites" || f === "Wiele brygad" ? <li key={f} className="free">{f}</li> : <li key={f}>{f}</li>))}</ul>
              <Link to={loginTo} className="btn btn-p" style={{ width: "100%", justifyContent: "center", fontSize: 14 }} {...loginLinkPrefetchProps}>{sections.pricing.startTrial}</Link>
            </div>
            <div className="pcard fu">
              <h3>{sections.pricing.business}</h3><div className="pr">{pricing.business.price}{pricing.business.suffix && <span>{pricing.business.suffix}</span>}</div><div className="yr">{pricing.business.subtitle}</div><div className="wf">{pricing.business.tag}</div>
              <ul>{pricing.business.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <Link to={loginTo} className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }} {...loginLinkPrefetchProps}>{sections.pricing.startTrial}</Link>
            </div>
            <div className="pcard fu">
              <h3>{sections.pricing.enterprise}</h3><div className="pr">{pricing.enterprise.price}{pricing.enterprise.suffix && <span>{pricing.enterprise.suffix}</span>}</div><div className="yr">{pricing.enterprise.subtitle}</div><div className="wf">{pricing.enterprise.tag}</div>
              <ul>{pricing.enterprise.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <Link to={loginTo} className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }} {...loginLinkPrefetchProps}>{sections.pricing.startTrial}</Link>
            </div>
            <div className="pcard fu">
              <h3>{sections.pricing.enterprisePlus}</h3><div className="pr" style={{ fontSize: 28 }}>{pricing.enterprisePlus.price}</div><div className="yr">{pricing.enterprisePlus.subtitle}</div><div className="wf">{pricing.enterprisePlus.tag}</div>
              <ul>{pricing.enterprisePlus.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(sections.pricing.enterpriseMailSubject)}`} className="btn btn-o" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>{sections.pricing.contactSales}</a>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--sl4)", marginTop: 24 }}>
            {copy.pricingFootnote}
          </p>
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--sl5)", marginTop: 10, maxWidth: 640, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            {getPriceAdjustmentShort(market.id)}{" "}
            <Link to={market.termsPath} style={{ color: "var(--sl4)", textDecoration: "underline" }}>
              {copy.pricingDisclaimer}
            </Link>
            .
          </p>
        </div>
      </section>

      <RoiEstimatorSection market={market} defaultRate={copy.roiDefaultRate} loginTo={loginTo} />

      <LandingBlogSection marketId={market.id} />

      <Suspense fallback={<FaqSuspenseFallback />}>
        <LandingFaqSection market={market} />
      </Suspense>

      <section className="missing" id="missing">
        <div className="ctn">
          <h2>{sections.missing.title}</h2>
          <p>{sections.missing.intro}</p>
          <div className="sub">{sections.missing.sub(supportEmail)}</div>
          <div className="mf">
            <label className="landing-sr-only" htmlFor="landing-feature-email">{sections.missing.emailLabel}</label>
            <input
              id="landing-feature-email"
              type="email"
              placeholder={sections.missing.emailPh}
              value={featureForm.email}
              onChange={(e) => onChangeFeature("email", e.target.value)}
              autoComplete="email"
              aria-label={sections.missing.emailLabel}
            />
            <label className="landing-sr-only" htmlFor="landing-feature-name">{sections.missing.nameLabel}</label>
            <input
              id="landing-feature-name"
              type="text"
              placeholder={sections.missing.namePh}
              value={featureForm.name}
              onChange={(e) => onChangeFeature("name", e.target.value)}
              autoComplete="organization"
              aria-label={sections.missing.nameLabel}
            />
          </div>
          <div className="mf">
            <label className="landing-sr-only" htmlFor="landing-feature-desc">{sections.missing.descLabel}</label>
            <textarea
              id="landing-feature-desc"
              placeholder={sections.missing.descPh}
              value={featureForm.desc}
              onChange={(e) => onChangeFeature("desc", e.target.value)}
              rows={4}
              aria-label={sections.missing.descLabel}
            />
          </div>
          <div className="mf">
            <button type="button" className="btn btn-p" onClick={onSubmitFeature}>{sections.missing.cta}</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--sl6)", marginTop: 8, position: "relative" }}>{sections.missing.footnote(supportEmail)}</p>
        </div>
      </section>

      <section className="comp" id="compliance">
        <div className="ctn">
          <div className="sh fu">
            <div className="badge" style={{ background: "rgba(13,148,136,.1)", color: "var(--teal)" }}>{copy.complianceBadge}</div>
            <h2>{copy.complianceTitle}</h2>
            <p>{copy.complianceIntro}</p>
          </div>
          <div className="cg">
            <div className="cl fu">
              {copy.complianceItems.map(([h4, p]) => (
                <div key={h4} className="ci"><div className="ck">✓</div><div><h4>{h4}</h4><p>{p}</p></div></div>
              ))}
            </div>
            <div className="cm fu"><div className="bs">{copy.complianceBadgeCode}</div></div>
          </div>
        </div>
      </section>

      <section className="cta" id="cta">
        <div className="ctn">
          <h2>{sections.cta.title}</h2>
          <p>{sections.cta.intro}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
            <label className="landing-sr-only" htmlFor="landing-cta-email">{sections.cta.emailLabel}</label>
            <input
              id="landing-cta-email"
              type="email"
              placeholder={sections.cta.emailPh}
              value={ctaEmail}
              onChange={(e) => onCtaEmailChange(e.target.value)}
              onFocus={prefetchLoginPage}
              autoComplete="email"
              aria-label={sections.cta.emailLabel}
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
            <button type="button" className="btn btn-p landing-btn-glow" onMouseEnter={prefetchLoginPage} onFocus={prefetchLoginPage} onClick={onCtaGo}>
              {sections.cta.button}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--sl6)", marginTop: 16, position: "relative" }}>
            {sections.cta.help} <a href={`mailto:${supportEmail}`} style={{ color: "var(--teal-l)" }}>{supportEmail}</a>
          </p>
        </div>
      </section>
    </>
  );
}
