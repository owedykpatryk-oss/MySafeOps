import { useCallback, useEffect, useMemo, useState } from "react";
import ConfettiCelebration from "../../../components/ConfettiCelebration";
import { markPermitGuideComplete } from "../../../utils/permitGuideStorage";

const ROLES = [
  { id: "operative", label: "Operative / contractor", hint: "Receive permits and carry out work safely on site.", icon: "🦺" },
  { id: "supervisor", label: "Supervisor", hint: "Review scope, approve, and activate permits before work starts.", icon: "👷" },
  { id: "admin", label: "Safety lead / admin", hint: "Tune forms, workflow gates, and audit without JSON.", icon: "⚙️" },
];

const FLOW_STEPS = [
  { id: "draft", label: "Draft", icon: "📝", hint: "Capture scope, location, RAMS link, and people." },
  { id: "review", label: "Review", icon: "🔍", hint: "Supervisor checks SIMOPS conflicts and competency." },
  { id: "issued", label: "Active", icon: "✅", hint: "Permit is live — work may proceed within validity window." },
  { id: "closed", label: "Closed", icon: "🔒", hint: "Work complete; lessons and evidence retained." },
];

const TIP_CARDS = [
  {
    id: "command",
    title: "Command strip",
    body: "One-tap filters for active, in review, handover due, and blocked permits.",
    target: "command",
    icon: "🎯",
  },
  {
    id: "views",
    title: "View modes",
    body: "Switch between list, board, timeline, TV wall, and safety map for the same data.",
    target: "views",
    icon: "🗂️",
  },
  {
    id: "bulk",
    title: "Bulk actions",
    body: "Select filtered permits to approve, activate, export site packs, or close in one go.",
    target: "bulk",
    icon: "⚡",
  },
  {
    id: "studio",
    title: "Configure PTW",
    body: "Open the configuration studio to edit fields, workflow rules, Slack/Teams alerts, and audit — no JSON required.",
    target: "studio",
    icon: "🛠️",
    adminOnly: true,
  },
];

const SPOTLIGHT_STEPS = [
  { target: '[data-permit-guide="command"]', title: "Command strip", body: "Tap a badge to filter the register — handover due and blocked now surface instantly." },
  { target: '[data-permit-guide="views"]', title: "View modes", body: "List for day-to-day ops; board for stand-ups; TV wall for the site office screen." },
  { target: '[data-permit-guide="bulk"]', title: "Bulk bar", body: "Select permits, then approve, activate, or export — great for shift change." },
  { target: '[data-permit-guide="studio"]', title: "Configuration studio", body: "Admins tune forms and workflow here. Collapsed by default so ops stay on top.", adminOnly: true },
];

function buildWizardSteps(isAdmin, supervisorMode = false) {
  if (supervisorMode) return ["welcome", "flow", "tips", "done"];
  const base = ["welcome", "role", "flow"];
  if (isAdmin) base.push("studio");
  base.push("tips", "done");
  return base;
}

function PermitGuideSpotlight({ steps, stepIndex, onNext, onBack, onFinish, isAdmin }) {
  const step = steps[stepIndex];
  const [rect, setRect] = useState(null);

  const resolveRect = useCallback(() => {
    if (!step?.target) return null;
    const el = document.querySelector(step.target);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const pad = 8;
    return {
      top: Math.max(8, box.top - pad),
      left: Math.max(8, box.left - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    };
  }, [step]);

  useEffect(() => {
    const el = step?.target ? document.querySelector(step.target) : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    const tick = () => setRect(resolveRect());
    const t1 = window.setTimeout(tick, 120);
    const t2 = window.setTimeout(tick, 480);
    window.addEventListener("resize", tick);
    window.addEventListener("scroll", tick, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", tick);
      window.removeEventListener("scroll", tick, true);
    };
  }, [step, resolveRect]);

  if (!step) return null;

  const tooltipTop = rect ? rect.top + rect.height + 14 : "50%";
  const tooltipLeft = rect ? Math.min(rect.left, window.innerWidth - 340) : "50%";

  return (
    <div className="ptw-guide-spotlight" role="dialog" aria-modal="true" aria-labelledby="ptw-guide-spotlight-title">
      <div className="ptw-guide-spotlight__dim" aria-hidden />
      {rect ? (
        <div
          className="ptw-guide-spotlight__ring"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden
        />
      ) : null}
      <div
        className="ptw-guide-spotlight__card app-panel-surface"
        style={{
          top: typeof tooltipTop === "number" ? tooltipTop : undefined,
          left: typeof tooltipLeft === "number" ? tooltipLeft : undefined,
        }}
      >
        <div className="ptw-guide-spotlight__progress" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.target} className={`ptw-guide-spotlight__dot${i <= stepIndex ? " ptw-guide-spotlight__dot--on" : ""}`} />
          ))}
        </div>
        <h3 id="ptw-guide-spotlight-title" className="ptw-guide-spotlight__title">{step.title}</h3>
        <p className="ptw-guide-spotlight__body">{step.body}</p>
        <div className="ptw-guide-spotlight__actions">
          <button type="button" className="app-onboarding-secondary" onClick={onFinish}>
            Skip tour
          </button>
          {stepIndex > 0 ? (
            <button type="button" className="app-onboarding-secondary" onClick={onBack}>
              Back
            </button>
          ) : null}
          <button type="button" className="app-onboarding-primary" onClick={stepIndex >= steps.length - 1 ? onFinish : onNext}>
            {stepIndex >= steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
        {!rect && isAdmin && step.adminOnly ? (
          <p className="ptw-guide-spotlight__fallback">Open <strong>Configure PTW</strong> in the toolbar to see this panel.</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * First-run PTW guide — wizard + optional spotlight tour for new users.
 */
export default function PermitFirstRunGuide({
  open,
  mode = "wizard",
  isAdmin = false,
  supervisorMode = false,
  onClose,
  onIssueFirst,
  onOpenStudio,
  onStartSpotlight,
}) {
  const [guideMode, setGuideMode] = useState(mode);
  const [stepIndex, setStepIndex] = useState(0);
  const [role, setRole] = useState("supervisor");
  const [celebrate, setCelebrate] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  const wizardSteps = useMemo(() => buildWizardSteps(isAdmin, supervisorMode), [isAdmin, supervisorMode]);
  const step = wizardSteps[stepIndex];
  const tips = useMemo(
    () => TIP_CARDS.filter((t) => !t.adminOnly || isAdmin),
    [isAdmin]
  );
  const spotlightSteps = useMemo(
    () => SPOTLIGHT_STEPS.filter((s) => !s.adminOnly || isAdmin),
    [isAdmin]
  );

  useEffect(() => {
    if (open) {
      setGuideMode(mode);
      setStepIndex(0);
      setSpotlightIndex(0);
      setCelebrate(false);
    }
  }, [open, mode]);

  useEffect(() => {
    if (step === "done") setCelebrate(true);
  }, [step]);

  const finish = useCallback((opts = {}) => {
    markPermitGuideComplete(role);
    setCelebrate(false);
    onClose?.(opts);
  }, [onClose, role]);

  const startSpotlight = useCallback(() => {
    setGuideMode("spotlight");
    setSpotlightIndex(0);
    onStartSpotlight?.();
  }, [onStartSpotlight]);

  if (!open) return null;

  if (guideMode === "spotlight") {
    return (
      <PermitGuideSpotlight
        steps={spotlightSteps}
        stepIndex={spotlightIndex}
        isAdmin={isAdmin}
        onNext={() => setSpotlightIndex((i) => Math.min(i + 1, spotlightSteps.length - 1))}
        onBack={() => setSpotlightIndex((i) => Math.max(0, i - 1))}
        onFinish={() => finish({ fromSpotlight: true })}
      />
    );
  }

  const roleMeta = ROLES.find((r) => r.id === role) || ROLES[1];

  return (
    <div className="app-onboarding-overlay ptw-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="ptw-guide-title">
      <ConfettiCelebration active={celebrate} label="PTW ready" onDone={() => setCelebrate(false)} />
      <div className="app-onboarding-panel app-panel-surface ptw-guide-panel">
        <div className="app-onboarding-progress" aria-hidden>
          {wizardSteps.map((id, i) => (
            <span
              key={id}
              className={`app-onboarding-progress__dot${i <= stepIndex ? " app-onboarding-progress__dot--done" : ""}${i === stepIndex ? " app-onboarding-progress__dot--active" : ""}`}
            />
          ))}
        </div>
        <button type="button" className="app-onboarding-close" aria-label="Skip guide" onClick={() => finish({ skipped: true })}>
          ×
        </button>

        {step === "welcome" ? (
          <>
            <div className="ptw-guide-hero" aria-hidden>
              <span className="ptw-guide-hero__orb ptw-guide-hero__orb--a" />
              <span className="ptw-guide-hero__orb ptw-guide-hero__orb--b" />
              <span className="ptw-guide-hero__emoji">📋</span>
            </div>
            <h2 id="ptw-guide-title" className="app-onboarding-title">
              {supervisorMode ? "Site supervisor — PTW quick start" : "Permit to Work — quick start"}
            </h2>
            <p className="app-onboarding-lead">
              {supervisorMode
                ? "Issue permits fast, monitor the TV wall, and keep shift handovers under control."
                : "Issue, review, and close permits with SIMOPS checks and a full audit trail. This 60-second guide shows what matters for your role."}
            </p>
            <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex(supervisorMode ? 1 : 1)}>
              Show me how →
            </button>
          </>
        ) : null}

        {step === "role" ? (
          <>
            <h2 className="app-onboarding-title">What&apos;s your role on site?</h2>
            <p className="app-onboarding-lead">We&apos;ll highlight the features you&apos;ll use most — you can reopen this guide anytime.</p>
            <div className="ptw-guide-roles">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`ptw-guide-role${role === r.id ? " ptw-guide-role--active" : ""}`}
                  onClick={() => setRole(r.id)}
                >
                  <span className="ptw-guide-role__icon" aria-hidden>{r.icon}</span>
                  <span className="ptw-guide-role__title">{r.label}</span>
                  <span className="ptw-guide-role__hint">{r.hint}</span>
                </button>
              ))}
            </div>
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(0)}>Back</button>
              <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex(2)}>Continue</button>
            </div>
          </>
        ) : null}

        {step === "flow" ? (
          <>
            <h2 className="app-onboarding-title">The permit lifecycle</h2>
            <p className="app-onboarding-lead">
              As a <strong>{roleMeta.label.toLowerCase()}</strong>, you&apos;ll mostly work across these stages:
            </p>
            <div className="ptw-guide-flow" role="list">
              {FLOW_STEPS.map((fs, idx) => (
                <div key={fs.id} className="ptw-guide-flow__wrap" role="listitem">
                  <div className="ptw-guide-flow__step" style={{ animationDelay: `${idx * 0.08}s` }}>
                    <span className="ptw-guide-flow__icon" aria-hidden>{fs.icon}</span>
                    <span className="ptw-guide-flow__label">{fs.label}</span>
                    <span className="ptw-guide-flow__hint">{fs.hint}</span>
                  </div>
                  {idx < FLOW_STEPS.length - 1 ? <span className="ptw-guide-flow__connector" aria-hidden /> : null}
                </div>
              ))}
            </div>
            <p className="app-onboarding-note">
              {role === "operative"
                ? "Use Quick issue for fast permits, or repeat a recent permit with a new location."
                : role === "admin"
                  ? "Admins can override workflow transitions and field rules in the configuration studio."
                  : "Use the command strip to find permits needing review or handover before shift change."}
            </p>
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(1)}>Back</button>
              <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex((i) => i + 1)}>Continue</button>
            </div>
          </>
        ) : null}

        {step === "studio" && isAdmin ? (
          <>
            <h2 className="app-onboarding-title">Configuration studio</h2>
            <p className="app-onboarding-lead">
              Admin settings sit <strong>below</strong> the permit list — collapsed by default so ops stay fast.
            </p>
            <div className="ptw-guide-studio-tabs" aria-hidden>
              <span className="ptw-guide-studio-tabs__tab ptw-guide-studio-tabs__tab--on">Form &amp; defaults</span>
              <span className="ptw-guide-studio-tabs__tab">Rules &amp; workflow</span>
              <span className="ptw-guide-studio-tabs__tab">System</span>
            </div>
            <ul className="ptw-guide-bullets">
              <li><strong>Form</strong> — required fields, placeholders, company defaults</li>
              <li><strong>Rules</strong> — conditional logic, conflicts, dependencies</li>
              <li><strong>System</strong> — shift handover, integrations, cloud audit</li>
            </ul>
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(2)}>Back</button>
              <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex((i) => i + 1)}>Continue</button>
            </div>
          </>
        ) : null}

        {step === "tips" ? (
          <>
            <h2 className="app-onboarding-title">Power features</h2>
            <p className="app-onboarding-lead">Tap a card — we&apos;ll point to it on screen after you finish.</p>
            <div className="ptw-guide-tips">
              {tips.map((tip, idx) => (
                <div key={tip.id} className="ptw-guide-tip" style={{ animationDelay: `${idx * 0.06}s` }}>
                  <span className="ptw-guide-tip__icon" aria-hidden>{tip.icon}</span>
                  <div>
                    <div className="ptw-guide-tip__title">{tip.title}</div>
                    <div className="ptw-guide-tip__body">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>Back</button>
              <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex((i) => i + 1)}>Almost done</button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <div className="app-onboarding-icon app-onboarding-icon--success" aria-hidden>✓</div>
            <h2 className="app-onboarding-title">You&apos;re set for PTW</h2>
            <p className="app-onboarding-lead">Pick a next step — or take the 30-second spotlight tour.</p>
            <ul className="app-onboarding-checklist">
              <li>
                <button type="button" onClick={() => { finish(); onIssueFirst?.(); }}>
                  Issue your first permit
                </button>
              </li>
              <li>
                <button type="button" onClick={startSpotlight}>
                  Show me around (spotlight tour)
                </button>
              </li>
              {isAdmin ? (
                <li>
                  <button type="button" onClick={() => { finish(); onOpenStudio?.(); }}>
                    Open configuration studio
                  </button>
                </li>
              ) : null}
            </ul>
            <button type="button" className="app-onboarding-primary" onClick={() => finish()}>
              Start using permits
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
