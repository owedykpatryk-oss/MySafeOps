import { useMemo } from "react";
import SvgBlock from "../shared/SvgBlock";
import { getOrgMarketId } from "../../../../utils/orgMarket";
import {
  confinedSpaceAssessment,
  confinedGuidanceCopy,
  renderConfinedGaugeSvg,
  renderConfinedRolesSvg,
  renderConfinedEntrySequenceSvg,
} from "../confinedSpaceGuidance";

const EMPTY_EXTRA = {};

export default function PermitConfinedSpaceGuidancePanel({ extraFields = {}, onExtraChange, ss = {}, marketId }) {
  const extra = extraFields || EMPTY_EXTRA;
  const market = marketId || getOrgMarketId();
  const copy = confinedGuidanceCopy(market);
  const yesNo = [
    { value: "", label: copy.selectLabel },
    { value: "yes", label: copy.yesLabel },
    { value: "no", label: copy.noLabel },
  ];
  const set = (key, value) => onExtraChange?.(key, value);
  const assessment = useMemo(() => confinedSpaceAssessment(extra, market), [extra, market]);

  const gaugeSvg = useMemo(() => renderConfinedGaugeSvg(extra, { marketId: market }), [extra, market]);
  const rolesSvg = useMemo(() => renderConfinedRolesSvg(extra, { marketId: market }), [extra, market]);
  const sequenceSvg = useMemo(() => renderConfinedEntrySequenceSvg({ marketId: market }), [market]);

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
          <div style={{ fontSize: 13, fontWeight: 800, color: "#791F1F" }}>{copy.panelTitle}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{copy.panelSubtitle}</div>
        </div>
        <a href={copy.refHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}>
          {copy.refLabel}
        </a>
      </div>

      <div style={{ marginBottom: 10 }}><SvgBlock html={gaugeSvg} title={copy.gasWidgetTitle} /></div>
      <div style={{ marginBottom: 10 }}><SvgBlock html={rolesSvg} title={copy.rolesWidgetTitle} /></div>
      <div style={{ marginBottom: 12 }}><SvgBlock html={sequenceSvg} title={copy.sequenceWidgetTitle} /></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>{copy.gasTesterLabel}</label>
          <input value={extra.gasTester || ""} onChange={(e) => set("gasTester", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.o2Label}</label>
          <input type="number" step={0.1} value={extra.o2Reading || ""} onChange={(e) => set("o2Reading", e.target.value)} style={inp} placeholder="19.5–23.5" />
        </div>
        <div>
          <label style={lbl}>{copy.coLabel}</label>
          <input type="number" step={1} value={extra.coReading || ""} onChange={(e) => set("coReading", e.target.value)} style={inp} placeholder="&lt;20" />
        </div>
        <div>
          <label style={lbl}>{copy.h2sLabel}</label>
          <input type="number" step={0.1} value={extra.h2sReading || ""} onChange={(e) => set("h2sReading", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.lelLabel}</label>
          <input type="number" step={0.1} value={extra.lelReading || ""} onChange={(e) => set("lelReading", e.target.value)} style={inp} placeholder="&lt;10" />
        </div>
        <div>
          <label style={lbl}>{copy.entrantLabel}</label>
          <input value={extra.entrantName || ""} onChange={(e) => set("entrantName", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.standbyLabel}</label>
          <input value={extra.standbyName || ""} onChange={(e) => set("standbyName", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.supervisorLabel}</label>
          <input value={extra.supervisorName || ""} onChange={(e) => set("supervisorName", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.rescueLabel}</label>
          <input value={extra.rescueTeamRef || ""} onChange={(e) => set("rescueTeamRef", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.ventilationLabel}</label>
          <select value={extra.ventilationActive || ""} onChange={(e) => set("ventilationActive", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.lotoLabel}</label>
          <select value={extra.lotoComplete || ""} onChange={(e) => set("lotoComplete", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.commsLabel}</label>
          <select value={extra.commsTested || ""} onChange={(e) => set("commsTested", e.target.value)} style={inp}>
            {yesNo.map((o) => (
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
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>{copy.readyCopy}</div>
      ) : null}
    </div>
  );
}
