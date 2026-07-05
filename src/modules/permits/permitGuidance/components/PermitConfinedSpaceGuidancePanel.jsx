import { useMemo } from "react";
import SvgBlock from "../shared/SvgBlock";
import {
  confinedSpaceAssessment,
  renderConfinedGaugeSvg,
  renderConfinedRolesSvg,
  renderConfinedEntrySequenceSvg,
} from "../confinedSpaceGuidance";

const YES_NO = [
  { value: "", label: "Select…" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default function PermitConfinedSpaceGuidancePanel({ extraFields = {}, onExtraChange, ss = {} }) {
  const extra = extraFields || {};
  const set = (key, value) => onExtraChange?.(key, value);
  const assessment = useMemo(() => confinedSpaceAssessment(extra), [extra]);

  const gaugeSvg = useMemo(() => renderConfinedGaugeSvg(extra), [extra]);
  const rolesSvg = useMemo(() => renderConfinedRolesSvg(extra), [extra]);
  const sequenceSvg = useMemo(() => renderConfinedEntrySequenceSvg({}), []);

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#791F1F" }}>Confined space entry</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>O₂ 19.5–23.5%, CO &lt;20 ppm, H₂S &lt;1 ppm, LEL &lt;10% — typical safe bands.</div>
        </div>
        <a href="https://www.hse.gov.uk/confinedspace/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}>
          HSE confined spaces
        </a>
      </div>

      <div style={{ marginBottom: 10 }}><SvgBlock html={gaugeSvg} title="Gas readings" /></div>
      <div style={{ marginBottom: 10 }}><SvgBlock html={rolesSvg} title="Roles" /></div>
      <div style={{ marginBottom: 12 }}><SvgBlock html={sequenceSvg} title="Entry sequence" /></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Gas tester / instrument ref</label>
          <input value={extra.gasTester || ""} onChange={(e) => set("gasTester", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>O₂ (%)</label>
          <input type="number" step={0.1} value={extra.o2Reading || ""} onChange={(e) => set("o2Reading", e.target.value)} style={inp} placeholder="19.5–23.5" />
        </div>
        <div>
          <label style={lbl}>CO (ppm)</label>
          <input type="number" step={1} value={extra.coReading || ""} onChange={(e) => set("coReading", e.target.value)} style={inp} placeholder="&lt;20" />
        </div>
        <div>
          <label style={lbl}>H₂S (ppm)</label>
          <input type="number" step={0.1} value={extra.h2sReading || ""} onChange={(e) => set("h2sReading", e.target.value)} style={inp} placeholder="&lt;1" />
        </div>
        <div>
          <label style={lbl}>LEL (%)</label>
          <input type="number" step={0.1} value={extra.lelReading || ""} onChange={(e) => set("lelReading", e.target.value)} style={inp} placeholder="&lt;10" />
        </div>
        <div>
          <label style={lbl}>Entrant name</label>
          <input value={extra.entrantName || ""} onChange={(e) => set("entrantName", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Standby (at entrance)</label>
          <input value={extra.standbyName || ""} onChange={(e) => set("standbyName", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Supervisor</label>
          <input value={extra.supervisorName || ""} onChange={(e) => set("supervisorName", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Rescue team ref</label>
          <input value={extra.rescueTeamRef || ""} onChange={(e) => set("rescueTeamRef", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Ventilation active</label>
          <select value={extra.ventilationActive || ""} onChange={(e) => set("ventilationActive", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>LOTO complete</label>
          <select value={extra.lotoComplete || ""} onChange={(e) => set("lotoComplete", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Comms tested</label>
          <select value={extra.commsTested || ""} onChange={(e) => set("commsTested", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
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
      {assessment.blockers.length === 0 && assessment.warnings.length === 0 && extra.o2Reading ? (
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Readings within typical bands — maintain continuous monitoring during occupation.</div>
      ) : null}
    </div>
  );
}
