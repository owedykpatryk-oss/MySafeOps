import { useMemo } from "react";
import {
  buildCadFieldComparison,
  buildCadVisualSummary,
  cadQlDisplayLabel,
  cadQlStyle,
  cadUtilityColor,
} from "../../utils/cadImportVisuals.js";
import { cadPreviewPathElements, cadQlDonutSegments } from "../../utils/cadPreviewSvg.js";
import { formatLengthM, formatSummaryLine } from "../../utils/surveyDxfAnalyzer.js";
import { PAS128_QUALITY_LEVELS, UTILITY_TYPE_OPTIONS } from "./surveyReportConstants.js";

const LAYER_QL_OPTIONS = [
  ...PAS128_QUALITY_LEVELS,
  { key: "TFR", label: "TFR (records)" },
  { key: "AR", label: "AR (as recorded)" },
];

function StatCard({ label, value, hint, accent }) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        minWidth: 110,
        padding: "10px 12px",
        borderRadius: 8,
        border: accent ? "1px solid #93c5fd" : "1px solid #e5e7eb",
        background: accent ? "linear-gradient(180deg,#eff6ff,#fff)" : "#fafafa",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ? "#1d4ed8" : "#0f766e", lineHeight: 1.2, marginTop: 2 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function QlBadge({ qlKey }) {
  const s = cadQlStyle(qlKey);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {cadQlDisplayLabel(qlKey)}
    </span>
  );
}

function BarChart({ rows, valueKey = "lengthM", labelKey = "label", colorKey = "color", suffix = " m" }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row) => {
        const pct = Math.round(((row[valueKey] || 0) / max) * 100);
        return (
          <div key={row.key || row.label} style={{ display: "grid", gridTemplateColumns: "88px 1fr 52px", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row[labelKey]}
            </span>
            <div style={{ height: 10, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: row[colorKey] || "#0d9488",
                  borderRadius: 999,
                  minWidth: pct > 0 ? 4 : 0,
                }}
              />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#111827", textAlign: "right" }}>
              {row[valueKey]}
              {suffix}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CompositionStrip({ composition, totalM }) {
  if (!composition?.length || !totalM) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb" }}>
        {composition.map((seg) => (
          <div
            key={seg.key}
            title={`${seg.label}: ${seg.lengthM} m`}
            style={{
              width: `${(seg.lengthM / totalM) * 100}%`,
              background: seg.color,
              minWidth: seg.lengthM > 0 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 8 }}>
        {composition.map((seg) => (
          <span key={seg.key} style={{ fontSize: 10, color: "#4b5563", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            {seg.label} · {seg.lengthM} m
          </span>
        ))}
      </div>
    </div>
  );
}

function CadPreviewMap({ preview }) {
  const width = 480;
  const height = 200;
  const paths = useMemo(() => cadPreviewPathElements(preview, width, height), [preview]);

  if (!paths?.length) return null;

  const legend = [];
  const seen = new Set();
  (preview.paths || []).forEach((p) => {
    const key = p.utilityKey || p.layer;
    if (seen.has(key)) return;
    seen.add(key);
    legend.push({ key, label: p.utilityLabel || p.layer, color: cadUtilityColor(p.utilityKey || "other") });
  });

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Linework plan preview</div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#f8fafc" }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="CAD linework preview">
          <rect x="0" y="0" width={width} height={height} fill="#f8fafc" />
          <rect x="10" y="10" width={width - 20} height={height - 20} fill="#fff" stroke="#e5e7eb" rx="4" />
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dash ? "4 3" : undefined}
              opacity="0.9"
            />
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
        {legend.slice(0, 6).map((item) => (
          <span key={item.key} style={{ fontSize: 10, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function QlDonut({ byQl, totalM }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const ir = size * 0.24;
  const segments = useMemo(() => cadQlDonutSegments(byQl, totalM), [byQl, totalM]);

  if (!segments.length) return null;

  const arcPath = (startDeg, endDeg) => {
    const polar = (deg) => {
      const rad = (deg * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const polarInner = (deg) => {
      const rad = (deg * Math.PI) / 180;
      return { x: cx + ir * Math.cos(rad), y: cy + ir * Math.sin(rad) };
    };
    const start = polar(endDeg);
    const end = polar(startDeg);
    const startInner = polarInner(endDeg);
    const endInner = polarInner(startDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${ir} ${ir} 0 ${large} 1 ${startInner.x} ${startInner.y}`,
      "Z",
    ].join(" ");
  };

  let angle = -90;
  const arcs = segments.map((seg) => {
    const start = angle;
    angle += seg.sweepAngle;
    return { ...seg, start, end: angle, d: arcPath(start, angle) };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="PAS128 QL share">
        {arcs.map((a) => (
          <path key={a.key} d={a.d} fill={a.color} opacity="0.92" />
        ))}
        <circle cx={cx} cy={cy} r={ir - 1} fill="#fff" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f766e">
          QL
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#6b7280">
          share
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {segments.slice(0, 5).map((q) => (
          <span key={q.key} style={{ fontSize: 10, color: "#4b5563", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: q.color }} />
            {q.key} {Math.round((q.lengthM / totalM) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function ImportDiffBanner({ diff }) {
  if (!diff) return null;
  const sign = diff.totalDeltaM > 0 ? "+" : "";
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: "#fffbeb",
        border: "1px solid #fcd34d",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
        Re-import vs {diff.previousFileName || "previous file"}
      </div>
      <div style={{ fontSize: 11, color: "#78350f" }}>
        Total {sign}
        {diff.totalDeltaM} m · {diff.segmentDelta >= 0 ? "+" : ""}
        {diff.segmentDelta} segments · {diff.layerDelta >= 0 ? "+" : ""}
        {diff.layerDelta} layers
      </div>
      {diff.changes?.slice(0, 4).map((c, i) => (
        <div key={i} style={{ fontSize: 10, color: "#92400e", marginTop: 2 }}>
          {c.type === "added" ? "+ " : c.type === "removed" ? "− " : "Δ "}
          {c.label}: {c.deltaM >= 0 ? "+" : ""}
          {c.deltaM} m
        </div>
      ))}
    </div>
  );
}

function LayerMappingPanel({ unmatchedLayers, layerMappings, onMappingChange }) {
  if (!unmatchedLayers?.length) return null;

  return (
    <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9a3412", marginBottom: 8 }}>Map unmatched layers</div>
      {unmatchedLayers.slice(0, 6).map((lr) => {
        const mapping = layerMappings?.[lr.layer] || {};
        return (
          <div
            key={lr.layer}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(100px,1fr) 120px 100px auto",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
              fontSize: 11,
            }}
          >
            <span style={{ fontWeight: 600, color: "#7c2d12" }}>
              {lr.layer} <span style={{ fontWeight: 400, color: "#9a3412" }}>({lr.lengthM} m)</span>
            </span>
            <select
              value={mapping.utilityKey || ""}
              onChange={(e) =>
                onMappingChange(lr.layer, { ...mapping, utilityKey: e.target.value, qlKey: mapping.qlKey || "B2" })
              }
              style={{ fontSize: 11, padding: "4px 6px", borderRadius: 4, border: "1px solid #fdba74" }}
            >
              <option value="">Utility…</option>
              {UTILITY_TYPE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={mapping.qlKey || ""}
              onChange={(e) => onMappingChange(lr.layer, { ...mapping, qlKey: e.target.value, utilityKey: mapping.utilityKey || "other" })}
              style={{ fontSize: 11, padding: "4px 6px", borderRadius: 4, border: "1px solid #fdba74" }}
            >
              <option value="">QL…</option>
              {LAYER_QL_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label?.replace(/^QL /, "") || o.key}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

export default function CadImportPanel({
  cadImport,
  utilitiesTable = [],
  onClear,
  cadBusy,
  onUpload,
  onLayerMappingsChange,
  ss,
}) {
  const visual = cadImport ? buildCadVisualSummary(cadImport) : null;
  const comparison = cadImport && utilitiesTable?.length ? buildCadFieldComparison(cadImport, utilitiesTable) : [];

  const handleMapping = (layer, mapping) => {
    if (!onLayerMappingsChange) return;
    const next = { ...(cadImport?.layerMappings || {}) };
    if (mapping.utilityKey && mapping.qlKey) next[layer] = mapping;
    else delete next[layer];
    onLayerMappingsChange(next);
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        borderRadius: 10,
        border: "0.5px solid #c7d9ec",
        background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#0f766e" }}>CAD utility mapping (DXF)</div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Measures <strong>LINE</strong>, <strong>LWPOLYLINE</strong> and <strong>3D POLYLINE</strong> only (plan length).
        Blocks, text and annotations are ignored. Layers like <code>UMG_LV_B1</code> map to utility + PAS128 QL.
      </p>
      <label
        style={{
          ...(cadBusy ? ss.btn : ss.btnP),
          display: "inline-block",
          cursor: cadBusy ? "wait" : "pointer",
          opacity: cadBusy ? 0.7 : 1,
        }}
      >
        {cadBusy ? "Analysing CAD…" : "+ Upload DXF"}
        <input type="file" accept=".dxf,.DXF" style={{ display: "none" }} disabled={cadBusy} onChange={onUpload} />
      </label>

      {cadImport?.fileName && visual && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{cadImport.fileName}</span>
            {cadImport.importedAt && (
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {new Date(cadImport.importedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            <span style={{ fontSize: 11, color: "#6b7280" }}>· {cadImport.units}</span>
            {visual.classifiedPct > 0 && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#ecfdf5", color: "#047857", fontWeight: 600 }}>
                {visual.classifiedPct}% auto-classified
              </span>
            )}
          </div>

          <ImportDiffBanner diff={cadImport.importDiff} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {visual.statCards.map((c) => (
              <StatCard key={c.label} {...c} />
            ))}
          </div>

          {cadImport.preview?.paths?.length > 0 && <CadPreviewMap preview={cadImport.preview} />}

          <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", margin: "14px 0 6px" }}>Linework composition</div>
          <CompositionStrip composition={visual.composition} totalM={visual.totalM} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Length by utility</div>
              <BarChart rows={visual.byUtility} labelKey="label" colorKey="color" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8 }}>PAS128 QL share</div>
              <QlDonut byQl={visual.byQl} totalM={visual.totalM} />
            </div>
          </div>

          <LayerMappingPanel
            unmatchedLayers={cadImport.unmatchedLayers}
            layerMappings={cadImport.layerMappings}
            onMappingChange={handleMapping}
          />

          <div style={{ marginTop: 16, overflowX: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Classified linework</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["Utility", "QL", "Length", "Share", "Layers"].map((h) => (
                    <th key={h} style={{ border: "1px solid #e5e7eb", padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cadImport.summary || []).map((row, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #e5e7eb", padding: "6px 8px" }}>{row.utilityLabel || "—"}</td>
                    <td style={{ border: "1px solid #e5e7eb", padding: "6px 8px" }}>
                      <QlBadge qlKey={row.qlKey || row.pas128Equivalent} />
                    </td>
                    <td style={{ border: "1px solid #e5e7eb", padding: "6px 8px", fontWeight: 600 }}>{row.lengthM} m</td>
                    <td style={{ border: "1px solid #e5e7eb", padding: "6px 8px", color: "#6b7280" }}>
                      {visual.totalM > 0 ? `${Math.round((row.lengthM / visual.totalM) * 100)}%` : "—"}
                    </td>
                    <td style={{ border: "1px solid #e5e7eb", padding: "6px 8px", fontSize: 10, color: "#6b7280" }}>
                      {(row.layers || []).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {comparison.some((r) => r.fieldCount > 0) && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#166534", marginBottom: 6 }}>CAD vs field schedule</div>
              {comparison
                .filter((r) => r.cadLengthM > 0)
                .map((r) => (
                  <div key={r.utilityKey} style={{ fontSize: 11, color: "#14532d", marginBottom: 2 }}>
                    {r.utilityLabel}: {formatLengthM(r.cadLengthM)} CAD · {r.fieldCount} row{r.fieldCount === 1 ? "" : "s"} in schedule
                    {r.hasFieldMatch ? " ✓" : " — no matching schedule row"}
                  </div>
                ))}
            </div>
          )}

          {cadImport.entityFilter?.skippedEntities &&
            Object.keys(cadImport.entityFilter.skippedEntities).length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#6b7280" }}>Ignored in file:</span>
                {Object.entries(cadImport.entityFilter.skippedEntities).map(([type, n]) => (
                  <span
                    key={type}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f3f4f6",
                      color: "#6b7280",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    {n}× {type}
                  </span>
                ))}
              </div>
            )}

          <details style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Text summary for findings</summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {(cadImport.summary || []).map((row, i) => (
                <li key={i}>{formatSummaryLine(row)}</li>
              ))}
            </ul>
          </details>

          <button type="button" style={{ ...ss.btn, fontSize: 11, marginTop: 12 }} onClick={onClear}>
            Clear CAD import
          </button>
        </div>
      )}
    </div>
  );
}
