import { memo } from "react";
import { gprAntennaAdvice, gprPenetrationRisk } from "./gprReportHelpers";

const ATTENUATION_COLOURS = {
  very_low: "#0d9488",
  low: "#059669",
  moderate: "#d97706",
  high: "#ea580c",
  very_high: "#dc2626",
};

function PenetrationBar({ expected, target, level }) {
  const max = Math.max(expected || 1, target || 1, 1) * 1.15;
  const expPct = expected ? Math.min(100, (expected / max) * 100) : 0;
  const tgtPct = target ? Math.min(100, (target / max) * 100) : 0;
  const tone = level === "risk" ? "#dc2626" : level === "caution" ? "#d97706" : "#0d9488";

  return (
    <div className="app-gpr-pen-bar" aria-hidden>
      <div className="app-gpr-pen-bar__track">
        <div className="app-gpr-pen-bar__fill" style={{ width: `${expPct}%`, background: tone }} title={`Indicative ${expected} m`} />
        {target ? (
          <div className="app-gpr-pen-bar__marker" style={{ left: `${tgtPct}%` }} title={`Target ${target} m`} />
        ) : null}
      </div>
      <div className="app-gpr-pen-bar__labels">
        <span>0 m</span>
        {expected ? <span className="app-gpr-pen-bar__exp">~{expected} m indicative</span> : null}
        {target ? <span className="app-gpr-pen-bar__tgt">Target {target} m</span> : null}
      </div>
    </div>
  );
}

function GprInsightPanel({ report, onApplyAntenna, onRecalcGround }) {
  const gc = report.groundConditions || {};
  const env = report.environmental || {};
  const risk = gprPenetrationRisk(report);
  const advice = gprAntennaAdvice(report);
  const attColour = ATTENUATION_COLOURS[gc.attenuationClass] || "#64748b";

  return (
    <div className="app-gpr-insight-panel">
      <div className="app-gpr-insight-grid">
        <div className="app-gpr-insight-card app-gpr-insight-card--geo">
          <div className="app-gpr-insight-card__head">
            <span className="app-gpr-insight-card__icon" aria-hidden>
              ◫
            </span>
            <strong>BGS geology</strong>
            {gc.fetchedAt ? (
              <span className="app-gpr-insight-badge app-gpr-insight-badge--ok">
                {gc.resolution === "50k" ? "50k" : gc.resolution === "625k" ? "625k" : "Live"}
              </span>
            ) : null}
          </div>
          {gc.accuracyWarning ? (
            <p className="app-gpr-insight-hint app-gpr-insight-hint--caution">{gc.accuracyWarning}</p>
          ) : null}
          {gc.artificial?.lexDescription || gc.superficial?.lexDescription || gc.bedrock?.lexDescription ? (
            <>
              {gc.scale ? (
                <p className="app-gpr-insight-card__line">
                  <em>Scale</em> {gc.scale}
                  {gc.coordSource ? ` · ${gc.coordSource}` : ""}
                </p>
              ) : null}
              {gc.artificial?.lexDescription ? (
                <p className="app-gpr-insight-card__line">
                  <em>Artificial</em> {gc.artificial.lexDescription}
                  {gc.artificial.rockDescription ? ` — ${gc.artificial.rockDescription}` : ""}
                </p>
              ) : null}
              {gc.superficial?.lexDescription ? (
                <p className="app-gpr-insight-card__line">
                  <em>Superficial</em> {gc.superficial.lexDescription}
                  {gc.superficial.rockDescription ? ` — ${gc.superficial.rockDescription}` : ""}
                </p>
              ) : null}
              {gc.bedrock?.lexDescription ? (
                <p className="app-gpr-insight-card__line">
                  <em>Bedrock</em> {gc.bedrock.lexDescription}
                </p>
              ) : null}
              {(gc.nearbyBoreholes || []).length ? (
                <p className="app-gpr-insight-card__line">
                  <em>Boreholes</em> {(gc.nearbyBoreholes || []).length} nearby
                  {gc.nearbyBoreholes[0]?.reference
                    ? ` (nearest ${gc.nearbyBoreholes[0].reference}${gc.nearbyBoreholes[0].distanceM != null ? ` ~${gc.nearbyBoreholes[0].distanceM} m` : ""})`
                    : ""}
                </p>
              ) : null}
              <div className="app-gpr-insight-metrics">
                <span style={{ borderColor: attColour, color: attColour }}>
                  Attenuation: {gc.attenuationClass?.replace(/_/g, " ") || "—"}
                </span>
                {gc.dielectricRange?.length === 2 ? (
                  <span>εr ~ {gc.dielectricRange[0]}–{gc.dielectricRange[1]}</span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="app-gpr-insight-card__empty">Fetch DigMap 50k + boreholes from project map pin</p>
          )}
          {onRecalcGround && gc.fetchedAt ? (
            <button type="button" className="app-gpr-insight-card__action" onClick={onRecalcGround}>
              Recalc for antenna MHz
            </button>
          ) : null}
        </div>

        <div className="app-gpr-insight-card app-gpr-insight-card--pen">
          <div className="app-gpr-insight-card__head">
            <span className="app-gpr-insight-card__icon" aria-hidden>
              ↯
            </span>
            <strong>Penetration</strong>
          </div>
          {gc.expectedPenetrationM != null ? (
            <>
              <p className="app-gpr-insight-card__big">~{gc.expectedPenetrationM} m</p>
              <PenetrationBar expected={gc.expectedPenetrationM} target={risk.target} level={risk.level} />
              {risk.message ? (
                <p className={`app-gpr-insight-hint app-gpr-insight-hint--${risk.level}`}>{risk.message}</p>
              ) : null}
            </>
          ) : (
            <p className="app-gpr-insight-card__empty">Set antenna MHz and fetch geology</p>
          )}
        </div>

        <div className="app-gpr-insight-card app-gpr-insight-card--ant">
          <div className="app-gpr-insight-card__head">
            <span className="app-gpr-insight-card__icon" aria-hidden>
              📡
            </span>
            <strong>Antenna</strong>
          </div>
          <p className="app-gpr-insight-card__line">
            Current: <strong>{advice.currentMhz} MHz</strong>
          </p>
          <p className="app-gpr-insight-card__line">{advice.label}</p>
          {!advice.match && onApplyAntenna ? (
            <button type="button" className="app-gpr-insight-card__action" onClick={() => onApplyAntenna(advice.mhz)}>
              Apply {advice.mhz} MHz recommendation
            </button>
          ) : advice.match ? (
            <span className="app-gpr-insight-badge app-gpr-insight-badge--ok">Frequency suited to target depth</span>
          ) : null}
        </div>

        <div className="app-gpr-insight-card app-gpr-insight-card--wx">
          <div className="app-gpr-insight-card__head">
            <span className="app-gpr-insight-card__icon" aria-hidden>
              ☁
            </span>
            <strong>Weather → GPR</strong>
          </div>
          {env.description ? (
            <>
              <p className="app-gpr-insight-card__line">{env.description}</p>
              {env.tempC != null ? (
                <p className="app-gpr-insight-card__line">
                  {env.tempMinC != null ? `${env.tempMinC}–` : ""}
                  {env.tempC}°C · Ground {env.groundSurface?.replace(/_/g, " ")}
                </p>
              ) : null}
              {env.moistureImpactOnGpr ? (
                <p className="app-gpr-insight-card__impact">{env.moistureImpactOnGpr.slice(0, 220)}
                  {env.moistureImpactOnGpr.length > 220 ? "…" : ""}
                </p>
              ) : null}
            </>
          ) : (
            <p className="app-gpr-insight-card__empty">Fetch weather for survey date</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(GprInsightPanel);
