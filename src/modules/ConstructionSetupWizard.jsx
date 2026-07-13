import { useState } from "react";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { openWorkspaceView } from "../utils/workspaceNavContext";
import { getConstructionWizardCopy } from "../data/appUiCopy";
import { getOrgMarketId } from "../utils/orgMarket";
import { getRamsShortLabel } from "../utils/marketLabels";
import {
  getConstructionSetupStatus,
  markConstructionStepDone,
  runConstructionSetupAction,
} from "../utils/constructionOnboarding";
import {
  getGeospatialSetupStatus,
  markGeospatialStepDone,
  runGeospatialSetupAction,
  isGeospatialPackActive,
} from "../utils/geospatialOnboarding";

const ss = ms;

export default function ConstructionSetupWizard() {
  const marketId = getOrgMarketId();
  const ramsLabel = getRamsShortLabel(marketId);
  const wizardCopy = getConstructionWizardCopy(marketId);
  const geospatial = isGeospatialPackActive();
  const geospatialLead =
    marketId === "au"
      ? `Onboarding for surveying & geodesy teams — AS5488, aerial LiDAR, laser scan, hydrographic and rail corridor ${ramsLabel} packs.`
      : marketId === "pl"
      ? `Onboarding dla geodezji — PAS128/AS5488, LiDAR, skan laserowy i pakiety IOR geodezyjnych.`
      : `Onboarding for surveying & geodesy teams — PAS128/AS5488, aerial LiDAR, laser scan, hydrographic and rail corridor ${ramsLabel} packs.`;
  const [status, setStatus] = useState(() => (geospatial ? getGeospatialSetupStatus() : getConstructionSetupStatus()));
  const [message, setMessage] = useState("");

  const refresh = () => setStatus(geospatial ? getGeospatialSetupStatus() : getConstructionSetupStatus());

  const runAction = (stepId) => {
    const result = geospatial ? runGeospatialSetupAction(stepId) : runConstructionSetupAction(stepId);
    setMessage(result.message || "");
    refresh();
  };

  const autoSteps = geospatial
    ? ["workspace_profile", "geospatial_packs", "legislation"]
    : ["workspace_profile", "hazard_packs", "legislation"];

  return (
    <div>
      <PageHero
        badgeText={geospatial ? "GEO" : wizardCopy.badge}
        title={geospatial ? "Geospatial setup" : wizardCopy.title}
        lead={
          geospatial
            ? geospatialLead
            : wizardCopy.lead
        }
      />

      <div style={{ ...ss.card, marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{wizardCopy.progress}</div>
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
              padding: "12px 14px",
              border: step.done ? "0.5px solid #9FE1CB" : "0.5px solid var(--color-border-tertiary,#e5e5e5)",
              background: step.done ? "linear-gradient(180deg,#fff 0%,#f0fdfa 100%)" : undefined,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  background: step.done ? "#EAF3DE" : "var(--color-background-secondary,#f7f7f5)",
                  color: step.done ? "#27500A" : "var(--color-text-secondary)",
                }}
              >
                {step.done ? "✓" : idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{step.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.45 }}>{step.hint}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                {autoSteps.includes(step.id) && !step.done ? (
                  <button type="button" style={{ ...ss.btnP, fontSize: 12, padding: "4px 10px" }} onClick={() => runAction(step.id)}>
                    {wizardCopy.runNow}
                  </button>
                ) : null}
                {step.viewId ? (
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 12, padding: "4px 10px" }}
                    onClick={() => openWorkspaceView({ viewId: step.viewId })}
                  >
                    {wizardCopy.open}
                  </button>
                ) : null}
                {!step.done ? (
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 12, padding: "4px 10px" }}
                    onClick={() => {
                      if (geospatial) markGeospatialStepDone(step.id);
                      else markConstructionStepDone(step.id);
                      refresh();
                    }}
                  >
                    {wizardCopy.markDone}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
