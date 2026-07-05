import { useMemo } from "react";
import SvgBlock from "../shared/SvgBlock";
import {
  DEFAULT_FIRE_WATCH_MINS,
  MAX_HOT_WORK_HOURS,
  hotWorkAssessment,
  renderFireWatchTimelineSvg,
  renderHotWorkGoNoGoSvg,
  renderHotWorkZoneSvg,
} from "../hotWorkGuidance";

const YES_NO = [
  { value: "", label: "Select…" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "na", label: "N/A" },
];

export default function PermitHotWorkGuidancePanel({ extraFields = {}, onExtraChange, ss = {}, permit = {} }) {
  const extra = extraFields || {};
  const set = (key, value) => onExtraChange?.(key, value);

  const assessment = useMemo(() => hotWorkAssessment(extra, permit), [extra, permit]);

  const zoneSvg = useMemo(() => renderHotWorkZoneSvg({}), []);
  const timelineSvg = useMemo(
    () => renderFireWatchTimelineSvg({ durationMins: assessment.fireWatchDurationMins }),
    [assessment.fireWatchDurationMins]
  );
  const goSvg = useMemo(() => renderHotWorkGoNoGoSvg(extra), [extra]);

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
          <div style={{ fontSize: 13, fontWeight: 800, color: "#991b1b" }}>Hot work controls</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, maxWidth: 520 }}>
            10 m zone clearance, fire watch min {DEFAULT_FIRE_WATCH_MINS} min post-work, typical {MAX_HOT_WORK_HOURS} h permit cap.
          </div>
        </div>
        <a
          href="https://www.hse.gov.uk/fireandexplosion/hot-work.htm"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}
        >
          HSE hot work
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 10 }}>
        <SvgBlock html={zoneSvg} title="10 m zone" />
        <SvgBlock html={goSvg} title="GO / NO-GO" />
      </div>
      <div style={{ marginBottom: 12 }}><SvgBlock html={timelineSvg} title="Fire watch timeline" /></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Equipment to be used</label>
          <input value={extra.equipment || ""} onChange={(e) => set("equipment", e.target.value)} style={inp} placeholder="Welder, grinder, torch…" />
        </div>
        <div>
          <label style={lbl}>Fire watcher name</label>
          <input value={extra.fireWatcher || ""} onChange={(e) => set("fireWatcher", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Fire watch duration (min)</label>
          <input
            type="number"
            min={DEFAULT_FIRE_WATCH_MINS}
            value={extra.fireWatchDurationMins || DEFAULT_FIRE_WATCH_MINS}
            onChange={(e) => set("fireWatchDurationMins", e.target.value)}
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>Post-work inspection time</label>
          <input type="datetime-local" value={extra.postInspectionTime || ""} onChange={(e) => set("postInspectionTime", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>10 m combustibles cleared</label>
          <select value={extra.combustiblesCleared10m || ""} onChange={(e) => set("combustiblesCleared10m", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Openings / ducts sealed</label>
          <select value={extra.openingsSealed || ""} onChange={(e) => set("openingsSealed", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>2 × extinguishers in place</label>
          <select value={extra.extinguishersInPlace || ""} onChange={(e) => set("extinguishersInPlace", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Fire blanket in place</label>
          <select value={extra.fireBlanketInPlace || ""} onChange={(e) => set("fireBlanketInPlace", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Fire alarm isolated</label>
          <select value={extra.alarmIsolated || ""} onChange={(e) => set("alarmIsolated", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Ventilation confirmed</label>
          <select value={extra.ventilationConfirmed || ""} onChange={(e) => set("ventilationConfirmed", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Post-watch signed off</label>
          <select value={extra.postWorkWatchSignedOff || ""} onChange={(e) => set("postWorkWatchSignedOff", e.target.value)} style={inp}>
            {YES_NO.filter((o) => o.value !== "na").map((o) => (
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
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>GO — hot work controls recorded. Maintain fire watch after work stops.</div>
      ) : null}
    </div>
  );
}
