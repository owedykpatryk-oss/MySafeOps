import { useEffect, useMemo, useState } from "react";
import { listFessJobStarters } from "../../utils/fessJobStarters";
import { canUseFessExclusiveFeatures } from "../../utils/fessExclusive";
import {
  getFessTemplateLibraryStats,
  listFessTemplateClients,
  searchFessRamsTemplates,
} from "../../utils/fessRamsTemplateLibrary";
import { getMcPdfCoverage } from "../../utils/fessMcPdfIndex";
import FessRamsCompletenessBadge from "../../components/FessRamsCompletenessBadge";

/**
 * FESS-only job starter picker + MC template library — Step 2 RAMS hazard screen.
 */
export default function FessJobStarterSection({
  form,
  rows = [],
  projects = [],
  hazardLibrary = [],
  onApplyFessJobStarter,
  suggestedStarterKey = "",
}) {
  const enabled = canUseFessExclusiveFeatures();
  const starters = useMemo(() => listFessJobStarters(), []);
  const stats = useMemo(() => getFessTemplateLibraryStats(), []);
  const mcCoverage = useMemo(() => getMcPdfCoverage(), []);
  const clients = useMemo(() => listFessTemplateClients(), []);
  const [starterKey, setStarterKey] = useState(form.fessJobStarterKey || suggestedStarterKey || "");
  const [libQuery, setLibQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  useEffect(() => {
    setStarterKey(form.fessJobStarterKey || suggestedStarterKey || "");
  }, [form.fessJobStarterKey, suggestedStarterKey]);

  const selected = useMemo(() => starters.find((s) => s.key === starterKey) || null, [starters, starterKey]);

  const templateResults = useMemo(
    () =>
      searchFessRamsTemplates(libQuery, {
        client: clientFilter,
        type: "starter",
      }).slice(0, 12),
    [libQuery, clientFilter]
  );

  if (!enabled) return null;

  return (
    <section
      className="app-rams-header-section"
      style={{ background: "var(--color-background-primary,#fff)", marginBottom: 20 }}
      aria-labelledby="rams-fess-starter"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
        <h3 id="rams-fess-starter" className="app-rams-header-section-title" style={{ margin: 0 }}>
          FESS job starter (food factory M&amp;E)
        </h3>
        <FessRamsCompletenessBadge form={form} rows={rows} projects={projects} library={hazardLibrary} />
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px", lineHeight: 1.45 }}>
        Pre-fill scope, method statement and standard site RA baseline plus job-specific hazards from FESS reference packs
        ({stats.starterCount} job types · {mcCoverage.mapped}/{mcCoverage.total} MC PDFs mapped).
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select value={starterKey} onChange={(e) => setStarterKey(e.target.value)} style={{ minWidth: 280, flex: 1 }}>
          <option value="">— Select job type —</option>
          {starters.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({s.siteHint})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!starterKey}
          onClick={() => onApplyFessJobStarter?.(starterKey)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #0f766e",
            background: starterKey ? "linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)" : "#e2e8f0",
            color: starterKey ? "#f0fdfa" : "#94a3b8",
            fontWeight: 600,
            cursor: starterKey ? "pointer" : "not-allowed",
            minHeight: 40,
          }}
        >
          Apply job starter
        </button>
        {form.fessJobStarterKey ? (
          <span style={{ fontSize: 11, color: "#0C447C", background: "#E6F1FB", padding: "2px 8px", borderRadius: 20 }}>
            Active: {form.fessJobStarterLabel || form.fessJobStarterKey}
          </span>
        ) : null}
      </div>
      {selected ? (
        <div
          style={{
            marginTop: 10,
            border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
            borderRadius: 8,
            padding: 10,
            background: "var(--color-background-secondary,#f7f7f5)",
            fontSize: 11,
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          <div>
            <strong>Client:</strong> {selected.client} · <strong>Site:</strong> {selected.siteHint}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Permits:</strong> {selected.permitTypes.map((t) => t.replace(/_/g, " ")).join(", ")}
          </div>
          <div style={{ marginTop: 4, color: "#64748b" }}>
            MC refs: {(selected.sourceFiles || []).slice(0, 2).join(" · ")}
            {(selected.sourceFiles || []).length > 2 ? ` (+${selected.sourceFiles.length - 2} more)` : ""}
          </div>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          borderTop: "1px solid #e2e8f0",
          paddingTop: 12,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "#134e4a", marginBottom: 8 }}>RAMS template library</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <input
            value={libQuery}
            onChange={(e) => setLibQuery(e.target.value)}
            placeholder="Search job type, client, site, PDF name…"
            style={{ flex: "1 1 200px", minWidth: 180, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
          />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{ minWidth: 160, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {templateResults.length === 0 ? (
            <span style={{ fontSize: 11, color: "#64748b" }}>No templates match — try a broader search.</span>
          ) : (
            templateResults.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setStarterKey(t.starterKey);
                  onApplyFessJobStarter?.(t.starterKey);
                }}
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 20,
                  border: "1px solid #99f6e4",
                  background: form.fessJobStarterKey === t.starterKey ? "#ccfbf1" : "#fff",
                  color: "#0f766e",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {t.label}
                <span style={{ color: "#64748b", marginLeft: 4 }}>· {t.siteHint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
