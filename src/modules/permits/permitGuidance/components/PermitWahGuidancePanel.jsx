import { useMemo } from "react";
import SvgBlock from "../shared/SvgBlock";
import { getOrgMarketId } from "../../../../utils/orgMarket";
import {
  wahAssessment,
  wahGuidanceCopy,
  renderWahHierarchySvg,
  renderWahAccessChoiceSvg,
  renderWahExclusionZoneSvg,
} from "../wahGuidance";

const EMPTY_EXTRA = {};

export default function PermitWahGuidancePanel({ permitType, extraFields = {}, onExtraChange, ss = {}, marketId }) {
  const extra = extraFields || EMPTY_EXTRA;
  const market = marketId || getOrgMarketId();
  const copy = wahGuidanceCopy(market);
  const yesNo = [
    { value: "", label: copy.selectLabel },
    { value: "yes", label: copy.yesLabel },
    { value: "no", label: copy.noLabel },
  ];
  const set = (key, value) => onExtraChange?.(key, value);
  const assessment = useMemo(() => wahAssessment(extra, market), [extra, market]);

  const hierarchySvg = useMemo(
    () => renderWahHierarchySvg({ highlight: String(extra.wahControlLevel || "").toLowerCase(), marketId: market }),
    [extra.wahControlLevel, market]
  );
  const accessSvg = useMemo(
    () => renderWahAccessChoiceSvg({ equipment: extra.accessEquipment, marketId: market }),
    [extra.accessEquipment, market]
  );
  const zoneSvg = useMemo(() => renderWahExclusionZoneSvg({ marketId: market }), [market]);

  const lbl = ss.lbl || { display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 };
  const inp = ss.inp || { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 12 };
  const title = permitType === "roof_access" ? copy.roofPanelTitle : copy.panelTitle;

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
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{copy.panelSubtitle}</div>
        </div>
        <a href={copy.refHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}>
          {copy.refLabel}
        </a>
      </div>

      <div style={{ marginBottom: 10 }}><SvgBlock html={hierarchySvg} title={copy.hierarchyWidgetTitle} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <SvgBlock html={accessSvg} title={copy.accessWidgetTitle} />
        <SvgBlock html={zoneSvg} title={copy.exclusionWidgetTitle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>{copy.accessEquipmentLabel}</label>
          <input value={extra.accessEquipment || ""} onChange={(e) => set("accessEquipment", e.target.value)} placeholder={copy.accessEquipmentPlaceholder} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.hierarchyLevelLabel}</label>
          <select value={extra.wahControlLevel || ""} onChange={(e) => set("wahControlLevel", e.target.value)} style={inp}>
            <option value="">{copy.selectLabel}</option>
            <option value="avoid">{copy.avoidOption}</option>
            <option value="prevent">{copy.preventOption}</option>
            <option value="mitigate">{copy.mitigateOption}</option>
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.maxHeightLabel}</label>
          <input type="number" min={0} step={0.1} value={extra.maxHeight || ""} onChange={(e) => set("maxHeight", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>{copy.exclusionLabel}</label>
          <select value={extra.exclusionZoneConfirmed || ""} onChange={(e) => set("exclusionZoneConfirmed", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.ipafLabel}</label>
          <select value={extra.ipafVerified || ""} onChange={(e) => set("ipafVerified", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.scaffoldLabel}</label>
          <select value={extra.scaffoldTagCurrent || ""} onChange={(e) => set("scaffoldTagCurrent", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>{copy.harnessLabel}</label>
          <select value={extra.harnessInspected || ""} onChange={(e) => set("harnessInspected", e.target.value)} style={inp}>
            {yesNo.map((o) => (
              <option key={o.value || "x"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>{copy.rescuePlanLabel}</label>
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
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>{copy.readyCopy}</div>
      )}
    </div>
  );
}
