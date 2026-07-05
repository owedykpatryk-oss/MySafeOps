import { useMemo } from "react";
import SvgBlock from "../permitGuidance/shared/SvgBlock";
import {
  DIG_EXTRA_FIELD_KEYS,
  PAS128_QUALITY_LEVELS,
  PAS128_SURVEY_TYPES,
  mechanicalDigAssessment,
  pas128QualityMeta,
  pas128SurveyMeta,
  renderHandDigBufferSvg,
  renderPas128QlLadderSvg,
  renderPas128SurveyTypeSvg,
  renderSafeDigFlowSvg,
  renderUtilityStrikeSvg,
} from "../permitDigGuidance";

export default function PermitDigGuidancePanel({ permitType, extraFields = {}, onExtraChange, ss = {} }) {
  const extra = extraFields || {};
  const set = (key, value) => onExtraChange?.(key, value);

  const assessment = useMemo(() => mechanicalDigAssessment(extra), [extra]);

  const qlSvg = useMemo(
    () => renderPas128QlLadderSvg({ highlightId: extra.pas128QualityLevel }),
    [extra.pas128QualityLevel]
  );
  const surveySvg = useMemo(
    () => renderPas128SurveyTypeSvg({ highlightId: extra.pas128SurveyType }),
    [extra.pas128SurveyType]
  );
  const flowSvg = useMemo(() => renderSafeDigFlowSvg({}), []);
  const bufferSvg = useMemo(
    () => renderHandDigBufferSvg({ bufferM: assessment.handDigBufferM }),
    [assessment.handDigBufferM]
  );
  const strikeSvg = useMemo(() => renderUtilityStrikeSvg({}), []);

  const qlMeta = pas128QualityMeta(extra.pas128QualityLevel);
  const surveyMeta = pas128SurveyMeta(extra.pas128SurveyType);

  const lbl = ss.lbl || { display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 };
  const inp = ss.inp || { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 12 };

  const isExcavation = permitType === "excavation";

  return (
    <div
      style={{
        marginBottom: 14,
        border: "1px solid #86efac",
        borderRadius: 12,
        padding: 12,
        background: "linear-gradient(180deg,#f0fdf4 0%,#fff 40%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#14532d" }}>Safe dig &amp; PAS 128</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, maxWidth: 520 }}>
            QL accuracy (D→A) and survey types (D, C, B1, B2, B3, A). B1 = single geophysical method (typical CAT &amp; Genny).
          </div>
        </div>
        <a
          href="https://www.hse.gov.uk/construction/safetytopics/buriedservices.htm"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#0C447C", fontWeight: 600 }}
        >
          HSE buried services (HSG47)
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginBottom: 10 }}>
        <SvgBlock html={qlSvg} title="PAS 128 quality levels" />
        <SvgBlock html={surveySvg} title="PAS 128 survey types" />
      </div>
      <div style={{ marginBottom: 10 }}>{flowSvg ? <SvgBlock html={flowSvg} title="Safe dig flow" /> : null}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <SvgBlock html={bufferSvg} title="Hand dig buffer" />
        <SvgBlock html={strikeSvg} title="Utility strike" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={lbl}>PAS 128 quality level</label>
          <select
            value={extra.pas128QualityLevel || ""}
            onChange={(e) => {
              const v = e.target.value;
              set("pas128QualityLevel", v);
              const meta = pas128QualityMeta(v);
              if (meta?.horizontalMm) set("horizontalAccuracyMm", String(meta.horizontalMm));
            }}
            style={inp}
          >
            <option value="">Select QL…</option>
            {PAS128_QUALITY_LEVELS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>PAS 128 survey type</label>
          <select
            value={extra.pas128SurveyType || ""}
            onChange={(e) => set("pas128SurveyType", e.target.value)}
            style={inp}
          >
            <option value="">Select type…</option>
            {PAS128_SURVEY_TYPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Mechanical dig permitted</label>
          <select value={extra.mechanicalDigAllowed || ""} onChange={(e) => set("mechanicalDigAllowed", e.target.value)} style={inp}>
            <option value="">Select…</option>
            <option value="no">No — hand dig only</option>
            <option value="partial">Partial — outside utility corridor</option>
            <option value="yes_with_buffer">Yes — with 0.5 m hand-dig buffer</option>
            <option value="yes_controlled">Yes — QL-A verified / engineered</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Trial pit / vacuum verify</label>
          <select value={extra.trialPitDone || ""} onChange={(e) => set("trialPitDone", e.target.value)} style={inp}>
            <option value="">Select…</option>
            <option value="yes">Yes — completed</option>
            <option value="planned">Planned at crossing</option>
            <option value="no">Not required / N/A</option>
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Survey / utility drawing reference</label>
          <input
            value={extra.surveyDrawingRef || ""}
            onChange={(e) => set("surveyDrawingRef", e.target.value)}
            placeholder="e.g. PAS128-B1-Rev3 / LSBUD ref / grid drawing"
            style={inp}
          />
        </div>
        {isExcavation ? (
          <>
            <div>
              <label style={lbl}>CAT scan carried out by</label>
              <input value={extra.catScanBy || ""} onChange={(e) => set("catScanBy", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Known services in area</label>
              <input value={extra.knownServices || ""} onChange={(e) => set("knownServices", e.target.value)} placeholder="Electric, gas, water, fibre…" style={inp} />
            </div>
            <div>
              <label style={lbl}>Max excavation depth (m)</label>
              <input type="number" min={0} step={0.1} value={extra.excavationDepth || ""} onChange={(e) => set("excavationDepth", e.target.value)} style={inp} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={lbl}>Ground type / geology</label>
              <input value={extra.groundType || ""} onChange={(e) => set("groundType", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Disturbance method</label>
              <input value={extra.disturbanceMethod || ""} onChange={(e) => set("disturbanceMethod", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Max disturbance depth (m)</label>
              <input type="number" min={0} step={0.1} value={extra.maxDepth || ""} onChange={(e) => set("maxDepth", e.target.value)} style={inp} />
            </div>
          </>
        )}
        <div>
          <label style={lbl}>Stated horizontal accuracy (mm)</label>
          <input type="number" min={0} value={extra.horizontalAccuracyMm || ""} onChange={(e) => set("horizontalAccuracyMm", e.target.value)} style={inp} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Utility strike / emergency contacts</label>
          <input
            value={extra.utilityStrikeContacts || ""}
            onChange={(e) => set("utilityStrikeContacts", e.target.value)}
            placeholder="Gas emergency, DNO, water undertaker, site control"
            style={inp}
          />
        </div>
      </div>

      {qlMeta ? (
        <div style={{ fontSize: 11, color: "#334155", marginBottom: 6, padding: "6px 8px", background: "#f8fafc", borderRadius: 6 }}>
          <strong>{qlMeta.id}:</strong> {qlMeta.summary}
        </div>
      ) : null}
      {surveyMeta ? (
        <div style={{ fontSize: 11, color: "#334155", marginBottom: 6, padding: "6px 8px", background: "#f8fafc", borderRadius: 6 }}>
          <strong>{surveyMeta.label}:</strong> {surveyMeta.methods} — {surveyMeta.note}
        </div>
      ) : null}

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
      {assessment.blockers.length === 0 && assessment.warnings.length === 0 && extra.pas128QualityLevel && extra.pas128SurveyType ? (
        <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Survey level recorded — align mark-up on ground before breaking ground.</div>
      ) : null}
    </div>
  );
}

export { DIG_EXTRA_FIELD_KEYS };
