import { useState } from "react";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { openWorkspaceView } from "../utils/workspaceNavContext";
import {
  getFoodPharmaSetupStatus,
  markFoodPharmaStepDone,
  runFoodPharmaSetupAction,
} from "../utils/foodPharmaOnboarding";

const ss = ms;

export default function FoodPharmaSetupWizard() {
  const [status, setStatus] = useState(() => getFoodPharmaSetupStatus());
  const [message, setMessage] = useState("");

  const refresh = () => setStatus(getFoodPharmaSetupStatus());

  const runAction = (stepId) => {
    const result = runFoodPharmaSetupAction(stepId);
    setMessage(result.message || "");
    refresh();
  };

  return (
    <div>
      <PageHero
        badgeText="F&P"
        title="Food & pharma setup"
        lead="Onboarding checklist for food, beverage and pharma sites — hazard packs, hygiene registers, COSHH and client portal in one session."
      />

      <div style={{ ...ss.card, marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Progress</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: status.pct >= 80 ? "#27500A" : status.pct >= 50 ? "#633806" : "#0C447C" }}>
              {status.complete}/{status.total} · {status.pct}%
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 400, height: 8, background: "var(--color-border-tertiary,#e5e5e5)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${status.pct}%`, height: "100%", background: status.pct >= 80 ? "#27500A" : "#0C447C", transition: "width 0.3s" }} />
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, fontSize: 13, color: "#27500A" }}>{message}</div> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {status.steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              ...ss.card,
              padding: 14,
              borderLeft: `3px solid ${step.done ? "#27500A" : "#94a3b8"}`,
              opacity: step.done ? 0.85 : 1,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  background: step.done ? "#EAF3DE" : "var(--color-background-secondary,#f1f5f9)",
                  color: step.done ? "#27500A" : "var(--color-text-secondary)",
                }}
              >
                {step.done ? "✓" : idx + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{step.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{step.hint}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {["workspace_profile", "hazard_packs", "legislation"].includes(step.id) && !step.done ? (
                    <button type="button" style={{ ...ss.btnP, fontSize: 12 }} onClick={() => runAction(step.id)}>
                      Run setup
                    </button>
                  ) : null}
                  {step.viewId ? (
                    <button
                      type="button"
                      style={{ ...ss.btn, fontSize: 12 }}
                      onClick={() => openWorkspaceView({ viewId: step.viewId })}
                    >
                      Open module
                    </button>
                  ) : null}
                  {!step.done ? (
                    <button
                      type="button"
                      style={{ ...ss.btn, fontSize: 12 }}
                      onClick={() => {
                        markFoodPharmaStepDone(step.id);
                        refresh();
                      }}
                    >
                      Mark done
                    </button>
                  ) : step.manual ? (
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Marked manually</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...ss.card, marginTop: 16, fontSize: 13, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
        <strong style={{ color: "var(--color-text-primary)" }}>What this unlocks:</strong> Food & pharma hazard packs, line clearance PTW, COSHH/A&E gates on RAMS,
        client RAMS approval, G&HP register, dynamic RA, and legislation traceability.
      </div>
    </div>
  );
}
