import { useMemo } from "react";
import SvgBlock from "../shared/SvgBlock";
import { getOrgMarketId } from "../../../../utils/orgMarket";
import {
  DEFAULT_FIRE_WATCH_MINS,
  hotWorkAssessment,
  hotWorkGuidanceCopy,
  renderFireWatchTimelineSvg,
  renderHotWorkGoNoGoSvg,
  renderHotWorkZoneSvg,
} from "../hotWorkGuidance";

const EMPTY_EXTRA = {};

export default function PermitHotWorkGuidancePanel({ extraFields = {}, onExtraChange, ss = {}, permit = {}, marketId }) {
  const extra = extraFields || EMPTY_EXTRA;
  const market = marketId || getOrgMarketId();
  const copy = hotWorkGuidanceCopy(market);
  const yesNo = [
    { value: "", label: copy.selectLabel },
    { value: "yes", label: copy.yesLabel },
    { value: "no", label: copy.noLabel },
    { value: "na", label: copy.naLabel },
  ];
  const set = (key, value) => onExtraChange?.(key, value);

  const assessment = useMemo(() => hotWorkAssessment(extra, permit, market), [extra, permit, market]);

  const zoneSvg = useMemo(() => renderHotWorkZoneSvg({ marketId: market }), [market]);
  const timelineSvg = useMemo(
    () => renderFireWatchTimelineSvg({ durationMins: assessment.fireWatchDurationMins }),
    [assessment.fireWatchDurationMins]
  );
  const goSvg = useMemo(() => renderHotWorkGoNoGoSvg(extra, { marketId: market }), [extra, market]);

  const lbl = ss.lbl || { display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 };
  const inp = ss.inp || { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 12 };

  return (
    <div
      style={{
        marginBottom: 14,
        border: "1px solid #fca5a5",
        borderRadius: 12,
        padding: 12,
        background: "linear-gradient(180deg,#fef2f2 0%,#fff 45%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#991b1b" }}>{copy.panelTitle}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, maxWidth: 520 }}>
            {copy.panelSubtitle}
          </div>
        </div>
        <a
          href={copy.refHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}
        >
          {copy.refLabel}
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 10 }}>
        <SvgBlock html={zoneSvg} title={copy.zoneTitle} />
        <SvgBlock html={goSvg} title={copy.goTitle} />
      </div>
      <div style={{ marginBottom: 12 }}><SvgBlock html={timelineSvg} title={copy.timelineTitle} /></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>{copy.equipmentLabel}</label>
          <input value={extra.equipment || ""} onChange={(e) => set("equipment", e.target.value)} style={inp} placeholder={copy.equipmentPlaceholder} />
        </div>
        <div>
          <label style={lbl}>{copy.fireWatcherLabel}</label>
          <input value={extra.fireWatcher || ""} onChange={(e) => set("fireWatcher", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.fireWatchDurationLabel}</label>
          <input
            type="number"
            min={DEFAULT_FIRE_WATCH_MINS}
            value={extra.fireWatchDurationMins || DEFAULT_FIRE_WATCH_MINS}
            onChange={(e) => set("fireWatchDurationMins", e.target.value)}
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>{copy.postInspectionLabel}</label>
          <input type="datetime-local" value={extra.postInspectionTime || ""} onChange={(e) => set("postInspectionTime", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.combustiblesLabel}</label>
          <select value={extra.combustiblesCleared10m || ""} onChange={(e) => set("combustiblesCleared10m", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.openingsLabel}</label>
          <select value={extra.openingsSealed || ""} onChange={(e) => set("openingsSealed", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.extinguishersLabel}</label>
          <select value={extra.extinguishersInPlace || ""} onChange={(e) => set("extinguishersInPlace", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.fireBlanketLabel}</label>
          <select value={extra.fireBlanketInPlace || ""} onChange={(e) => set("fireBlanketInPlace", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.alarmLabel}</label>
          <select value={extra.alarmIsolated || ""} onChange={(e) => set("alarmIsolated", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.ventilationLabel}</label>
          <select value={extra.ventilationConfirmed || ""} onChange={(e) => set("ventilationConfirmed", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.postWatchLabel}</label>
          <select value={extra.postWorkWatchSignedOff || ""} onChange={(e) => set("postWorkWatchSignedOff", e.target.value)} style={inp}>
            {yesNo.filter((o) => o.value !== "na").map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {assessment.blockers.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#991b1b" }}>
          {assessment.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {assessment.warnings.length > 0 ? (
        <ul style={{ margin: assessment.blockers.length ? "6px 0 0" : 0, paddingLeft: 18, fontSize: 11, color: "#92400e" }}>
          {assessment.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {assessment.ready ? (
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>{copy.readyCopy}</div>
      ) : null}
    </div>
  );
}
