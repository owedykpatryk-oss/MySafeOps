import { useMemo } from "react";
import RegisterHealthRing from "./RegisterHealthRing";
import { buildMoreCommandCentrePulse } from "../utils/moreSectionPulse";
import { getIndustryPackLabel } from "../utils/industryPackProfile";

/**
 * Top-of-More command centre — combined site + HSE pulse.
 */
export default function MorePanelCommandCentre({ siteTabs, hseTabs, statsMap, onOpenModule }) {
  const pulse = useMemo(
    () => buildMoreCommandCentrePulse(siteTabs, hseTabs, statsMap),
    [siteTabs, hseTabs, statsMap]
  );
  const profileLabel = useMemo(() => getIndustryPackLabel(), []);

  return (
    <div className="app-more-command">
      <div className="app-more-command__glow" aria-hidden />
      <div className="app-more-command__inner">
        <div className="app-more-command__eyebrow">
          Operations command centre · <span className="app-more-command__profile">{profileLabel}</span>
        </div>
        <div className="app-more-command__row">
          <RegisterHealthRing score={pulse.combinedScore} color={pulse.scoreColor} size={72} label="Overall" />
          <div className="app-more-command__stats">
            <div className="app-more-command__stat">
              <span className="app-more-command__stat-val">{pulse.records.toLocaleString()}</span>
              <span className="app-more-command__stat-lbl">Records</span>
            </div>
            <div className="app-more-command__stat">
              <span className="app-more-command__stat-val app-more-command__stat-val--warn">{pulse.attention}</span>
              <span className="app-more-command__stat-lbl">Need attention</span>
            </div>
            <div className="app-more-command__stat">
              <span className="app-more-command__stat-val">{pulse.empty}</span>
              <span className="app-more-command__stat-lbl">Empty registers</span>
            </div>
          </div>
          {pulse.nextAction ? (
            <button
              type="button"
              className="app-more-command__cta"
              onClick={() => onOpenModule(pulse.nextAction.viewId)}
            >
              <span className="app-more-command__cta-kicker">Priority action</span>
              <span className="app-more-command__cta-title">{pulse.nextAction.label}</span>
              <span className="app-more-command__cta-sub">{pulse.nextAction.reason}</span>
            </button>
          ) : (
            <div className="app-more-command__ok">
              <strong>All clear</strong>
              <span>Site and HSE registers look healthy — export packs when you need audit evidence.</span>
            </div>
          )}
        </div>
        {pulse.attentionModules.length > 0 ? (
          <div className="app-more-command__strip">
            {pulse.attentionModules.map((m) => (
              <button key={m.id} type="button" className="app-more-command__strip-chip" onClick={() => onOpenModule(m.id)}>
                {m.label}
                {m.attentionCount > 0 ? <em>{m.attentionCount}</em> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
