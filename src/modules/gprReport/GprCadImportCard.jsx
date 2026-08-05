import { memo, useMemo } from "react";
import { formatLengthM } from "../../utils/surveyDxfAnalyzer.js";
import { formatAreaM2 } from "../../utils/dxfHatchAnalyzer.js";
import { summariseGprAnomalies } from "./gprCadImport.js";
import { openHelpGuide } from "../../utils/workspaceNavContext.js";

function Stat({ label, value, hint, accent }) {
  return (
    <div
      style={{
        flex: "1 1 110px",
        minWidth: 100,
        padding: "10px 12px",
        borderRadius: 8,
        border: accent ? "1px solid #5eead4" : "1px solid #e5e7eb",
        background: accent ? "linear-gradient(180deg,#f0fdfa,#fff)" : "#fafafa",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f766e", lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {hint ? <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

function GprCadImportCard({
  gprCadImport,
  anomalies = [],
  cadBusy,
  onUpload,
  onClear,
  ss,
}) {
  const cad = gprCadImport;
  const g = cad?.gprLayers;
  const b1 = cad?.umgB1Upgrades;
  const umg = cad?.umgAll;
  const hatches = cad?.hatches;
  // Live anomaly totals from the open report (CAD snapshot kept for PDF narrative).
  const a = useMemo(() => summariseGprAnomalies(anomalies), [anomalies]);

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        borderRadius: 10,
        border: "0.5px solid #99f6e4",
        background: "linear-gradient(180deg, #f0fdfa 0%, #fff 100%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f766e" }}>
          CAD model-space verification (DXF)
        </div>
        <button
          type="button"
          style={{ ...ss.btn, fontSize: 11, padding: "4px 8px" }}
          onClick={() => openHelpGuide({ guideId: "gpr-cad-import" })}
        >
          Help
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Reads <strong>model space only</strong> — paper layouts ignored. Counts layers with <code>GPR</code> in the name,
        <code>UMG_*</code> → <strong>QL-B1</strong> upgrades, and <strong>hatches</strong> for vegetation / foliage /
        obstruction / building / no-access (area + “unable to survey” narrative). Anomalies come from this report.
      </p>

      <label
        style={{
          ...(cadBusy ? ss.btn : ss.btnP || ss.btn),
          display: "inline-block",
          cursor: cadBusy ? "wait" : "pointer",
          opacity: cadBusy ? 0.7 : 1,
          background: cadBusy ? undefined : "#0d9488",
          color: cadBusy ? undefined : "#fff",
        }}
      >
        {cadBusy ? "Analysing CAD…" : "+ Upload DXF (model space)"}
        <input type="file" accept=".dxf,.DXF" style={{ display: "none" }} disabled={cadBusy} onChange={onUpload} />
      </label>

      {cad?.fileName ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{cad.fileName}</span>
            {cad.importedAt ? (
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {new Date(cad.importedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </span>
            ) : null}
            <span style={{ fontSize: 11, color: "#6b7280" }}>· {cad.units || "m"}</span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#ecfdf5",
                color: "#047857",
                fontWeight: 600,
              }}
            >
              Model space only
            </span>
            {cad.paperspaceSkipped > 0 ? (
              <span style={{ fontSize: 10, color: "#b45309" }}>
                {cad.paperspaceSkipped} layout entit{cad.paperspaceSkipped === 1 ? "y" : "ies"} skipped
              </span>
            ) : null}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <Stat
              label="GPR layers"
              value={String(g?.segmentCount ?? 0)}
              hint={g?.lengthM ? formatLengthM(g.lengthM) : "no GPR-named layers"}
              accent={(g?.segmentCount || 0) > 0}
            />
            <Stat
              label="UMG → B1"
              value={String(b1?.segmentCount ?? 0)}
              hint={b1?.lengthM ? `${formatLengthM(b1.lengthM)} upgraded` : "no B1 upgrades"}
              accent={(b1?.segmentCount || 0) > 0}
            />
            <Stat
              label="Anomalies"
              value={String(a?.count ?? 0)}
              hint={
                a?.count
                  ? `${a.withDepth || 0} with depth · ${a.highConfidence || 0} high conf.`
                  : "log on Findings"
              }
              accent={(a?.count || 0) > 0}
            />
            <Stat
              label="UMG total"
              value={formatLengthM(umg?.lengthM || 0)}
              hint={`${umg?.segmentCount || 0} segment(s)`}
            />
            <Stat
              label="No-access hatches"
              value={String(hatches?.constraintHatchCount ?? 0)}
              hint={
                hatches?.totalConstraintAreaM2
                  ? formatAreaM2(hatches.totalConstraintAreaM2)
                  : "vegetation / obstruction / building"
              }
              accent={(hatches?.constraintHatchCount || 0) > 0}
            />
          </div>

          {(g?.byLayer || []).length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                GPR-named layers
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
                {g.byLayer.slice(0, 8).map((lr) => (
                  <li key={lr.layer}>
                    <strong>{lr.layer}</strong> — {formatLengthM(lr.lengthM)} ({lr.segments} seg.)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(b1?.byUtility || []).length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                UMG upgraded to QL-B1 (by utility)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
                {b1.byUtility.map((row) => (
                  <li key={row.utilityKey}>
                    <strong>{row.utilityLabel}</strong> — {formatLengthM(row.lengthM)} ({row.segments} seg.)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(a?.byType || []).length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Anomalies by type
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.byType.map((t) => (
                  <span
                    key={t.key}
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "#f0f9ff",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      fontWeight: 600,
                    }}
                  >
                    {t.label}: {t.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {(umg?.byQl || []).length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                All UMG_* by PAS128 QL
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {umg.byQl.map((q) => (
                  <span
                    key={q.qlKey}
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: q.qlKey === "B1" ? "#ecfdf5" : "#f3f4f6",
                      color: q.qlKey === "B1" ? "#047857" : "#4b5563",
                      border: `1px solid ${q.qlKey === "B1" ? "#a7f3d0" : "#e5e7eb"}`,
                      fontWeight: 600,
                    }}
                  >
                    QL {q.qlKey}: {formatLengthM(q.lengthM)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {(hatches?.byCategory || []).length > 0 ? (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9a3412", marginBottom: 6 }}>
                Unable to survey / no access (hatches)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5, color: "#7c2d12" }}>
                {hatches.byCategory.map((c) => (
                  <li key={c.key}>
                    <strong>{c.label}</strong> — {c.hatchCount} hatch{c.hatchCount === 1 ? "" : "es"} ·{" "}
                    {formatAreaM2(c.areaM2)}
                    <div style={{ fontSize: 11, color: "#9a3412", marginTop: 2 }}>{c.narrative}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {onClear ? (
            <button type="button" style={{ ...ss.btn, fontSize: 11, marginTop: 4 }} onClick={onClear}>
              Clear CAD import
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default memo(GprCadImportCard);
