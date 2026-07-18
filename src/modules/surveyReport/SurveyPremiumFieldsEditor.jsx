/**
 * Editor panels for UM premium survey fields — evidence, records, extent, kit, custom sections.
 */
import { useState } from "react";
import {
  RECORD_STATUS_OPTIONS,
  RECORD_SERVICE_TYPES,
} from "./surveyReportConstants";
import {
  blankEvidenceRow,
  blankExtentArea,
  blankRecordItem,
  blankCustomSection,
  blankEquipmentKitItem,
  blankGprAnomalyCard,
  blankSurveyArea,
  GPR_ANOMALY_CLASSES,
  defaultEquipmentKitForMethod,
  buildRecordsMatrixNarrative,
  seedSurveyAreasFromExtent,
} from "./surveyEvidencePack";
import { blankMhIcCard } from "./surveyPlanRemaining";
import { importGprReportIntoSurvey, listGprReportsForSurveyProject } from "./surveyGprBridge";
import { appendEvidenceFromGeoPhotos, applyUndertakerPaste } from "./surveyFieldUpgrades";

const box = {
  border: "1px solid var(--color-border-tertiary, #e2e8f0)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  background: "var(--color-background-secondary, #f8fafc)",
};
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#334155" };
const inp = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  boxSizing: "border-box",
  minHeight: 44,
};
const btn = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 44,
  touchAction: "manipulation",
};
const btnDanger = { ...btn, color: "#b91c1c", borderColor: "#fecaca" };
const btnPrimary = { ...btn, background: "#0B1D3A", color: "#fff", borderColor: "#0B1D3A" };

function updateAt(list, id, patch) {
  return (list || []).map((row) => (row.id === id ? { ...row, ...patch } : row));
}

function removeAt(list, id) {
  return (list || []).filter((row) => row.id !== id);
}

/**
 * @param {{ form: object, setForm: Function, gprReports?: object[], project?: object|null, onFetchGeology?: Function|null, geologyBusy?: boolean }} props
 */
export default function SurveyPremiumFieldsEditor({
  form,
  setForm,
  gprReports = [],
  project = null,
  geoPhotos = [],
  onFetchGeology = null,
  geologyBusy = false,
  onToast = null,
}) {
  const bump = (patch) => setForm((f) => ({ ...f, ...patch, updatedAt: new Date().toISOString() }));
  const projectGpr = listGprReportsForSurveyProject(gprReports, form.projectId);
  const linkedGpr = projectGpr.find((g) => g.id === form.linkedGprReportId) || projectGpr[0];
  const [undertakerPaste, setUndertakerPaste] = useState("");

  const importFromGpr = (mode = "merge") => {
    const gpr = projectGpr.find((g) => g.id === form.linkedGprReportId) || linkedGpr;
    if (!gpr) return;
    setForm((f) => {
      const withLink =
        !f.linkedGprReportId && gpr.id ? { ...f, linkedGprReportId: gpr.id } : f;
      return importGprReportIntoSurvey(withLink, gpr, { merge: mode === "merge", replace: mode === "replace" });
    });
  };

  return (
    <div className="survey-premium-fields">
      <div style={{ ...box, borderColor: "#00B4E4" }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Records status matrix</div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          Tick outcomes per undertaker — the PDF writes a clear Located / TFR / Not located narrative you can still edit.
        </p>
        {(form.recordItems || []).map((row) => (
          <div key={row.id} className="survey-premium-fields__row survey-premium-fields__row--records" style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            <input
              style={inp}
              placeholder="Undertaker (e.g. SGN)"
              value={row.undertaker || ""}
              onChange={(e) => bump({ recordItems: updateAt(form.recordItems, row.id, { undertaker: e.target.value }) })}
            />
            <select
              style={inp}
              value={row.serviceType || "other"}
              onChange={(e) => bump({ recordItems: updateAt(form.recordItems, row.id, { serviceType: e.target.value }) })}
            >
              {RECORD_SERVICE_TYPES.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              style={inp}
              value={row.status || "not_located"}
              onChange={(e) =>
                bump({
                  recordItems: updateAt(form.recordItems, row.id, {
                    status: e.target.value,
                    tfr: e.target.value === "tfr",
                  }),
                })
              }
            >
              {RECORD_STATUS_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" style={btnDanger} onClick={() => bump({ recordItems: removeAt(form.recordItems, row.id) })}>
              Remove
            </button>
            <input
              style={{ ...inp, gridColumn: "1 / -1" }}
              placeholder="Notes (optional)"
              value={row.notes || ""}
              onChange={(e) => bump({ recordItems: updateAt(form.recordItems, row.id, { notes: e.target.value }) })}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => bump({ recordItems: [...(form.recordItems || []), blankRecordItem()] })}>
            + Record row
          </button>
          <button
            type="button"
            style={btn}
            onClick={() =>
              bump({
                recordItemsNarrative: buildRecordsMatrixNarrative(form.recordItems || [], ""),
              })
            }
          >
            Generate prose from ticks
          </button>
        </div>
        <label style={{ ...lbl, marginTop: 12 }}>Paste undertaker / LSBUD email</label>
        <textarea
          style={{ ...inp, minHeight: 64 }}
          value={undertakerPaste}
          onChange={(e) => setUndertakerPaste(e.target.value)}
          placeholder={"Cadent Gas: apparatus present\nBT Openreach: no plant\nUKPN: records only / TFR"}
        />
        <button
          type="button"
          style={{ ...btnPrimary, marginTop: 8 }}
          onClick={() => {
            const { report: next, added } = applyUndertakerPaste(form, undertakerPaste);
            setForm((f) => ({ ...f, ...next }));
            setUndertakerPaste("");
            onToast?.({
              type: added ? "success" : "warn",
              title: added ? `Added ${added} undertaker row(s)` : "Nothing parsed",
              message: added
                ? "Review status chips, then Generate prose from ticks."
                : "Paste lines like “Cadent Gas: apparatus present” or “BT: no plant”.",
            });
          }}
        >
          Parse paste → records matrix
        </button>
        <label style={{ ...lbl, marginTop: 10 }}>Narrative override (editable)</label>
        <textarea
          style={{ ...inp, minHeight: 72 }}
          value={form.recordItemsNarrative || ""}
          onChange={(e) => bump({ recordItemsNarrative: e.target.value })}
          placeholder="Leave blank to auto-build from the matrix, or write your own §5.1 wording."
        />
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Evidence rows (CAD | photo | notes)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button
            type="button"
            style={btnPrimary}
            disabled={!geoPhotos?.length}
            onClick={() => {
              const next = appendEvidenceFromGeoPhotos(form, geoPhotos, { limit: 8 });
              const added = (next.evidenceRows?.length || 0) - (form.evidenceRows?.length || 0);
              bump({ evidenceRows: next.evidenceRows });
              onToast?.({
                type: added ? "success" : "warn",
                title: added ? `Added ${added} evidence row(s)` : "No new geo-photos",
                message: added
                  ? "Fill CAD crop + explanation on each row."
                  : "Mark geo-photos on this project first, or they are already linked.",
              });
            }}
          >
            One-tap from geo-photos
          </button>
          <button type="button" style={btn} onClick={() => bump({ evidenceRows: [...(form.evidenceRows || []), blankEvidenceRow()] })}>
            + Empty evidence row
          </button>
        </div>
        {(form.evidenceRows || []).map((row) => (
          <div key={row.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}>
            <div className="survey-premium-fields__row survey-premium-fields__row--2" style={{ display: "grid", gap: 8 }}>
              <input
                style={inp}
                placeholder="Title"
                value={row.title || ""}
                onChange={(e) => bump({ evidenceRows: updateAt(form.evidenceRows, row.id, { title: e.target.value }) })}
              />
              <input
                style={inp}
                placeholder="Undertaker / AOC"
                value={row.undertaker || ""}
                onChange={(e) => bump({ evidenceRows: updateAt(form.evidenceRows, row.id, { undertaker: e.target.value }) })}
              />
              <input
                style={inp}
                placeholder="CAD / plan image URL or data URL"
                value={row.cadImageUrl || ""}
                onChange={(e) => bump({ evidenceRows: updateAt(form.evidenceRows, row.id, { cadImageUrl: e.target.value }) })}
              />
              <input
                style={inp}
                placeholder="Site photo URL or data URL"
                value={(row.photoUrls && row.photoUrls[0]) || ""}
                onChange={(e) =>
                  bump({
                    evidenceRows: updateAt(form.evidenceRows, row.id, {
                      photoUrls: e.target.value ? [e.target.value] : [],
                    }),
                  })
                }
              />
            </div>
            <label style={{ ...lbl, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={Boolean(row.tfr)}
                onChange={(e) => bump({ evidenceRows: updateAt(form.evidenceRows, row.id, { tfr: e.target.checked }) })}
              />
              TFR (taken from records)
            </label>
            <textarea
              style={{ ...inp, minHeight: 64, marginTop: 6 }}
              placeholder="Explanation / findings note"
              value={row.body || ""}
              onChange={(e) => bump({ evidenceRows: updateAt(form.evidenceRows, row.id, { body: e.target.value }) })}
            />
            <button type="button" style={{ ...btnDanger, marginTop: 6 }} onClick={() => bump({ evidenceRows: removeAt(form.evidenceRows, row.id) })}>
              Remove evidence row
            </button>
          </div>
        ))}
        <button
          type="button"
          style={{ ...btn, marginTop: 8 }}
          onClick={() => bump({ evidenceRows: [...(form.evidenceRows || []), blankEvidenceRow({ title: "Site evidence" })] })}
        >
          + Evidence row
        </button>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Survey extent AOC</div>
        {(form.extentAreas || []).map((row) => (
          <div key={row.id} className="survey-premium-fields__row survey-premium-fields__row--2" style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <input
              style={inp}
              placeholder="Label (e.g. AOC1)"
              value={row.label || ""}
              onChange={(e) => bump({ extentAreas: updateAt(form.extentAreas, row.id, { label: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Chainage (e.g. CH 1100m)"
              value={row.chainage || ""}
              onChange={(e) => bump({ extentAreas: updateAt(form.extentAreas, row.id, { chainage: e.target.value }) })}
            />
            <input
              style={{ ...inp, gridColumn: "1 / -1" }}
              placeholder="Plan / extent image URL"
              value={row.planImageUrl || ""}
              onChange={(e) => bump({ extentAreas: updateAt(form.extentAreas, row.id, { planImageUrl: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Lat (optional — multi-point BGS)"
              value={row.lat || ""}
              onChange={(e) => bump({ extentAreas: updateAt(form.extentAreas, row.id, { lat: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Lng (optional)"
              value={row.lng || ""}
              onChange={(e) => bump({ extentAreas: updateAt(form.extentAreas, row.id, { lng: e.target.value }) })}
            />
            <button
              type="button"
              style={btn}
              disabled={!project?.lat || !project?.lng}
              onClick={() =>
                bump({
                  extentAreas: updateAt(form.extentAreas, row.id, {
                    lat: String(project.lat),
                    lng: String(project.lng),
                  }),
                })
              }
            >
              Copy project pin
            </button>
            <button type="button" style={btnDanger} onClick={() => bump({ extentAreas: removeAt(form.extentAreas, row.id) })}>
              Remove AOC
            </button>
          </div>
        ))}
        <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px" }}>
          Add lat/lng on AOCs to sample DigMap at up to 3 points when you fetch BGS geology.
        </p>
        <button type="button" style={btn} onClick={() => bump({ extentAreas: [...(form.extentAreas || []), blankExtentArea({ label: "AOC" })] })}>
          + Extent area
        </button>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Multi-area flipbook</div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          District Heating style — one page per corridor / AOC with plan, photos and findings.
        </p>
        {(form.extentAreas || []).length > 0 && !(form.surveyAreas || []).length ? (
          <button
            type="button"
            style={{ ...btn, marginBottom: 8 }}
            onClick={() => setForm((f) => seedSurveyAreasFromExtent(f))}
          >
            Seed flipbook from extent AOC
          </button>
        ) : null}
        {(form.surveyAreas || []).map((row) => (
          <div key={row.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}>
            <div className="survey-premium-fields__row survey-premium-fields__row--2" style={{ display: "grid", gap: 8 }}>
              <input
                style={inp}
                placeholder="Area label"
                value={row.label || ""}
                onChange={(e) => bump({ surveyAreas: updateAt(form.surveyAreas, row.id, { label: e.target.value }) })}
              />
              <input
                style={inp}
                placeholder="Chainage"
                value={row.chainage || ""}
                onChange={(e) => bump({ surveyAreas: updateAt(form.surveyAreas, row.id, { chainage: e.target.value }) })}
              />
              <input
                style={{ ...inp, gridColumn: "1 / -1" }}
                placeholder="Plan image URL"
                value={row.planImageUrl || ""}
                onChange={(e) => bump({ surveyAreas: updateAt(form.surveyAreas, row.id, { planImageUrl: e.target.value }) })}
              />
              <input
                style={{ ...inp, gridColumn: "1 / -1" }}
                placeholder="Photo URL (first)"
                value={(row.photoUrls && row.photoUrls[0]) || ""}
                onChange={(e) =>
                  bump({
                    surveyAreas: updateAt(form.surveyAreas, row.id, {
                      photoUrls: e.target.value ? [e.target.value] : [],
                    }),
                  })
                }
              />
            </div>
            <textarea
              style={{ ...inp, minHeight: 56, marginTop: 6 }}
              placeholder="Area notes"
              value={row.notes || ""}
              onChange={(e) => bump({ surveyAreas: updateAt(form.surveyAreas, row.id, { notes: e.target.value }) })}
            />
            <textarea
              style={{ ...inp, minHeight: 56, marginTop: 6 }}
              placeholder="Findings for this area"
              value={row.findingsNote || ""}
              onChange={(e) => bump({ surveyAreas: updateAt(form.surveyAreas, row.id, { findingsNote: e.target.value }) })}
            />
            <button type="button" style={{ ...btnDanger, marginTop: 6 }} onClick={() => bump({ surveyAreas: removeAt(form.surveyAreas, row.id) })}>
              Remove area
            </button>
          </div>
        ))}
        <button
          type="button"
          style={{ ...btn, marginTop: 8 }}
          onClick={() => bump({ surveyAreas: [...(form.surveyAreas || []), blankSurveyArea({ label: "Area" })] })}
        >
          + Survey area
        </button>
      </div>

      <div style={{ ...box, borderColor: "#0B1D3A" }} data-survey-anchor="gpr-cards">
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>GPR anomaly cards</div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          Gallions-style cards — import from a linked GPR report, or add manually. Screenshots attach when radargram line refs match.
        </p>
        {projectGpr.length > 0 ? (
          <div className="survey-premium-fields__row survey-premium-fields__row--gpr-link" style={{ display: "grid", gap: 8, marginBottom: 10, alignItems: "end" }}>
            <div>
              <label style={lbl}>Linked GPR report</label>
              <select
                style={inp}
                value={form.linkedGprReportId || ""}
                onChange={(e) => bump({ linkedGprReportId: e.target.value })}
              >
                <option value="">— Select —</option>
                {projectGpr.map((g) => (
                  <option key={g.id} value={g.id}>
                    {(g.ref || g.title || g.id).slice(0, 48)}
                    {(g.anomalies || []).length
                      ? ` · ${(g.anomalies || []).length} anomal${(g.anomalies || []).length === 1 ? "y" : "ies"}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" style={btnPrimary} disabled={!linkedGpr} onClick={() => importFromGpr("merge")}>
              Import anomalies
            </button>
            <button type="button" style={btn} disabled={!linkedGpr} onClick={() => importFromGpr("replace")}>
              Replace all
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0 }}>
            No GPR reports on this project yet — create one in GPR, then import anomalies here.
          </p>
        )}
        <textarea
          style={{ ...inp, minHeight: 64, marginBottom: 10 }}
          placeholder="GPR conclusions / dashboard narrative"
          value={form.gprConclusions || ""}
          onChange={(e) => bump({ gprConclusions: e.target.value })}
        />
        {(form.gprAnomalyCards || []).map((row) => (
          <div key={row.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}>
            <div className="survey-premium-fields__row survey-premium-fields__row--3" style={{ display: "grid", gap: 8 }}>
              <input
                style={inp}
                placeholder="Ref (e.g. A-12)"
                value={row.ref || ""}
                onChange={(e) => bump({ gprAnomalyCards: updateAt(form.gprAnomalyCards, row.id, { ref: e.target.value }) })}
              />
              <select
                style={inp}
                value={row.classKey || "unknown"}
                onChange={(e) => bump({ gprAnomalyCards: updateAt(form.gprAnomalyCards, row.id, { classKey: e.target.value }) })}
              >
                {GPR_ANOMALY_CLASSES.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                style={inp}
                placeholder="Screenshot URL"
                value={row.screenshotUrl || ""}
                onChange={(e) => bump({ gprAnomalyCards: updateAt(form.gprAnomalyCards, row.id, { screenshotUrl: e.target.value }) })}
              />
              <input
                style={inp}
                placeholder="Depth min (m)"
                value={row.depthMinM || ""}
                onChange={(e) => bump({ gprAnomalyCards: updateAt(form.gprAnomalyCards, row.id, { depthMinM: e.target.value }) })}
              />
              <input
                style={inp}
                placeholder="Depth max (m)"
                value={row.depthMaxM || ""}
                onChange={(e) => bump({ gprAnomalyCards: updateAt(form.gprAnomalyCards, row.id, { depthMaxM: e.target.value }) })}
              />
            </div>
            <textarea
              style={{ ...inp, minHeight: 56, marginTop: 6 }}
              placeholder="Interpretation"
              value={row.interpretation || ""}
              onChange={(e) => bump({ gprAnomalyCards: updateAt(form.gprAnomalyCards, row.id, { interpretation: e.target.value }) })}
            />
            <button
              type="button"
              style={{ ...btnDanger, marginTop: 6 }}
              onClick={() => bump({ gprAnomalyCards: removeAt(form.gprAnomalyCards, row.id) })}
            >
              Remove anomaly
            </button>
          </div>
        ))}
        <button
          type="button"
          style={{ ...btn, marginTop: 8 }}
          onClick={() => bump({ gprAnomalyCards: [...(form.gprAnomalyCards || []), blankGprAnomalyCard({ ref: "A-" })] })}
        >
          + GPR anomaly
        </button>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Equipment kit thickbox</div>
        <button
          type="button"
          style={{ ...btn, marginBottom: 8 }}
          onClick={() => bump({ equipmentKit: defaultEquipmentKitForMethod(form.pas128Method || "M2") })}
        >
          Seed kit from PAS128 method
        </button>
        {(form.equipmentKit || []).map((row) => (
          <div key={row.id} className="survey-premium-fields__row survey-premium-fields__row--2" style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            <input
              style={inp}
              placeholder="Technique"
              value={row.technique || ""}
              onChange={(e) => bump({ equipmentKit: updateAt(form.equipmentKit, row.id, { technique: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Trade name"
              value={row.tradeName || ""}
              onChange={(e) => bump({ equipmentKit: updateAt(form.equipmentKit, row.id, { tradeName: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Manufacturer"
              value={row.manufacturer || ""}
              onChange={(e) => bump({ equipmentKit: updateAt(form.equipmentKit, row.id, { manufacturer: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Appendix ref (e.g. Appendix 1)"
              value={row.appendixRef || ""}
              onChange={(e) => bump({ equipmentKit: updateAt(form.equipmentKit, row.id, { appendixRef: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Calibration due"
              value={row.calibrationDue || ""}
              onChange={(e) => bump({ equipmentKit: updateAt(form.equipmentKit, row.id, { calibrationDue: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Datasheet / photo URL"
              value={row.photoUrl || ""}
              onChange={(e) => bump({ equipmentKit: updateAt(form.equipmentKit, row.id, { photoUrl: e.target.value }) })}
            />
            <button type="button" style={btnDanger} onClick={() => bump({ equipmentKit: removeAt(form.equipmentKit, row.id) })}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" style={btn} onClick={() => bump({ equipmentKit: [...(form.equipmentKit || []), blankEquipmentKitItem()] })}>
          + Kit item
        </button>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>MH / IC survey cards</div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          For M4 / M4P — cover and invert levels print as chamber cards in findings.
        </p>
        {(form.mhIcCards || []).map((row) => (
          <div key={row.id} className="survey-premium-fields__row survey-premium-fields__row--3" style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            <input
              style={inp}
              placeholder="Ref (MH01)"
              value={row.ref || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { ref: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Cover level"
              value={row.coverLevel || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { coverLevel: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Invert level"
              value={row.invertLevel || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { invertLevel: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Pipes in"
              value={row.pipesIn || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { pipesIn: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Pipes out"
              value={row.pipesOut || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { pipesOut: e.target.value }) })}
            />
            <input
              style={inp}
              placeholder="Photo URL"
              value={row.photoUrl || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { photoUrl: e.target.value }) })}
            />
            <textarea
              style={{ ...inp, gridColumn: "1 / -1", minHeight: 48 }}
              placeholder="Notes"
              value={row.notes || ""}
              onChange={(e) => bump({ mhIcCards: updateAt(form.mhIcCards, row.id, { notes: e.target.value }) })}
            />
            <button type="button" style={btnDanger} onClick={() => bump({ mhIcCards: removeAt(form.mhIcCards, row.id) })}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" style={btn} onClick={() => bump({ mhIcCards: [...(form.mhIcCards || []), blankMhIcCard()] })}>
          + MH / IC card
        </button>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Geological context (BGS)</div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          Fetches <strong>BGS DigMap 50k</strong> (bedrock / superficial / artificial) plus nearby borehole index,
          with 625k fallback. Still desk study — not SI soils. Best accuracy needs a <strong>project map pin</strong>{" "}
          (postcode centroid can name the wrong unit next door).
        </p>
        {!project?.lat || !project?.lng ? (
          <p style={{ fontSize: 12, color: "#b45309", marginTop: 0 }}>
            This project has no map pin — set lat/lng on the project before relying on geology names.
          </p>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {typeof onFetchGeology === "function" ? (
            <button
              type="button"
              style={btnPrimary}
              disabled={geologyBusy || !project}
              onClick={() => onFetchGeology(false)}
            >
              {geologyBusy ? "Fetching…" : "Fetch BGS geology (50k)"}
            </button>
          ) : null}
          {typeof onFetchGeology === "function" && form.geology?.formation ? (
            <button type="button" style={btn} disabled={geologyBusy || !project} onClick={() => onFetchGeology(true)}>
              Re-fetch (overwrite)
            </button>
          ) : null}
        </div>
        {form.geology?.accuracyWarning ? (
          <p style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", padding: 8, borderRadius: 8, marginTop: 0 }}>
            {form.geology.accuracyWarning}
          </p>
        ) : null}
        {form.geology?.fetchedAt ? (
          <p style={{ fontSize: 11, color: "#0f766e", marginTop: 0 }}>
            Last fetch {new Date(form.geology.fetchedAt).toLocaleString("en-GB")}
            {form.geology.scale ? ` · ${form.geology.scale}` : ""}
            {form.geology.coordSource ? ` · ${form.geology.coordSource}` : ""}
            {form.geology.queryLat != null
              ? ` · ${Number(form.geology.queryLat).toFixed(5)}, ${Number(form.geology.queryLng).toFixed(5)}`
              : ""}
            {form.geology.materialClass ? ` · ${String(form.geology.materialClass).replace(/_/g, " ")}` : ""}
            {(form.geology.nearbyBoreholes || []).length
              ? ` · ${(form.geology.nearbyBoreholes || []).length} nearby boreholes`
              : ""}
            {(form.geology.samplePoints || []).length > 1
              ? ` · ${form.geology.samplePoints.length} sample points`
              : ""}
          </p>
        ) : null}
        {(form.geology?.samplePoints || []).length > 1 ? (
          <div style={{ fontSize: 12, marginBottom: 10, overflowX: "auto" }}>
            <strong>Multi-point samples</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {(form.geology.samplePoints || []).map((s) => (
                <li key={s.id || s.label}>
                  {s.label}: {s.materialClass?.replace(/_/g, " ") || "—"}
                  {s.superficialLabel ? ` — ${s.superficialLabel}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <input
          style={{ ...inp, marginBottom: 8 }}
          placeholder="Formation / superficial deposits"
          value={form.geology?.formation || ""}
          onChange={(e) => bump({ geology: { ...(form.geology || {}), formation: e.target.value } })}
        />
        <textarea
          style={{ ...inp, minHeight: 56, marginBottom: 8 }}
          placeholder="Implications for GPR / detection"
          value={form.geology?.implications || ""}
          onChange={(e) => bump({ geology: { ...(form.geology || {}), implications: e.target.value } })}
        />
        <textarea
          style={{ ...inp, minHeight: 48 }}
          placeholder="Extra notes / site observations (made ground, fill, water table…)"
          value={form.geology?.notes || ""}
          onChange={(e) => bump({ geology: { ...(form.geology || {}), notes: e.target.value } })}
        />
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#0B1D3A" }}>Custom report sections</div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>Add your own headings and text — they print after findings.</p>
        {(form.customSections || []).map((row) => (
          <div key={row.id} style={{ marginBottom: 10 }}>
            <input
              style={inp}
              placeholder="Section title"
              value={row.title || ""}
              onChange={(e) => bump({ customSections: updateAt(form.customSections, row.id, { title: e.target.value }) })}
            />
            <textarea
              style={{ ...inp, minHeight: 72, marginTop: 6 }}
              placeholder="Body text"
              value={row.body || ""}
              onChange={(e) => bump({ customSections: updateAt(form.customSections, row.id, { body: e.target.value }) })}
            />
            <button type="button" style={{ ...btnDanger, marginTop: 6 }} onClick={() => bump({ customSections: removeAt(form.customSections, row.id) })}>
              Remove section
            </button>
          </div>
        ))}
        <button
          type="button"
          style={btn}
          onClick={() => bump({ customSections: [...(form.customSections || []), blankCustomSection({ title: "Additional notes" })] })}
        >
          + Custom section
        </button>
      </div>
    </div>
  );
}
