import { useMemo } from "react";
import SvgBlock from "../shared/SvgBlock";
import {
  wahAssessment,
  renderWahHierarchySvg,
  renderWahAccessChoiceSvg,
  renderWahExclusionZoneSvg,
} from "../wahGuidance";

const YES_NO = [
  { value: "", label: "Select…" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default function PermitWahGuidancePanel({ permitType, extraFields = {}, onExtraChange, ss = {} }) {
  const extra = extraFields || {};
  const set = (key, value) => onExtraChange?.(key, value);
  const assessment = useMemo(() => wahAssessment(extra), [extra]);

  const hierarchySvg = useMemo(
    () => renderWahHierarchySvg({ highlight: String(extra.wahControlLevel || "").toLowerCase() }),
    [extra.wahControlLevel]
  );
  const accessSvg = useMemo(() => renderWahAccessChoiceSvg({ equipment: extra.accessEquipment }), [extra.accessEquipment]);
  const zoneSvg = useMemo(() => renderWahExclusionZoneSvg({}), []);

  const lbl = ss.lbl || { display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 };
  const inp = ss.inp || { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 12 };
  const title = permitType === "roof_access" ? "Roof access / WAH" : "Work at height";

  return (
    <div
      style={{
        marginBottom: 14,
        border: "1px solid #fcd34d",
        borderRadius: 12,
        padding: 12,
        background: "linear-gradient(180deg,#fffbeb 0%,#fff 45%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#854F0B" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>WAH Regulations 2005 — Avoid → Prevent → Mitigate.</div>
        </div>
        <a href="https://www.hse.gov.uk/work-at-height/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}>
          HSE work at height
        </a>
      </div>

      <div style={{ marginBottom: 10 }}><SvgBlock html={hierarchySvg} title="WAH hierarchy" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <SvgBlock html={accessSvg} title="Access method" />
        <SvgBlock html={zoneSvg} title="Exclusion zone" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Access equipment type / ref</label>
          <input value={extra.accessEquipment || ""} onChange={(e) => set("accessEquipment", e.target.value)} placeholder="Ladder / MEWP / scaffold tag" style={inp} />
        </div>
        <div>
          <label style={lbl}>Hierarchy control level</label>
          <select value={extra.wahControlLevel || ""} onChange={(e) => set("wahControlLevel", e.target.value)} style={inp}>
            <option value="">Select…</option>
            <option value="avoid">Avoid — ground level</option>
            <option value="prevent">Prevent — collective (guardrails)</option>
            <option value="mitigate">Mitigate — harness / PPE</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Maximum working height (m)</label>
          <input type="number" min={0} step={0.1} value={extra.maxHeight || ""} onChange={(e) => set("maxHeight", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Exclusion zone below work</label>
          <select value={extra.exclusionZoneConfirmed || ""} onChange={(e) => set("exclusionZoneConfirmed", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>IPAF / MEWP verified</label>
          <select value={extra.ipafVerified || ""} onChange={(e) => set("ipafVerified", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Scaffold tag current</label>
          <select value={extra.scaffoldTagCurrent || ""} onChange={(e) => set("scaffoldTagCurrent", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Harness / lanyard inspected</label>
          <select value={extra.harnessInspected || ""} onChange={(e) => set("harnessInspected", e.target.value)} style={inp}>
            {YES_NO.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Rescue plan reference</label>
          <input value={extra.rescuePlan || ""} onChange={(e) => set("rescuePlan", e.target.value)} style={inp} />
        </div>
      </div>

      {assessment.warnings.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: "#92400e" }}>
          {assessment.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>WAH controls recorded — site RAMS governs method selection.</div>
      )}
    </div>
  );
}
