import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  listSurveyTemplatesForEditor,
  saveSurveyTypeTemplateOverride,
  resetSurveyTypeTemplateOverride,
} from "../utils/surveyOrgTemplates";
import { ms } from "../utils/moduleStyles";

const ss = {
  ...ms,
  ta: { ...ms.inp, resize: "vertical", minHeight: 72, fontSize: 12, lineHeight: 1.45 },
};

const SURVEY_GROUPS = [
  { id: "utility", label: "Utility & PAS128", match: /utility|eml|pas128|cctv|drainage/i },
  { id: "topo", label: "Topographic & setting out", match: /topograph|setting|gnss|control/i },
  { id: "scan", label: "Scanning & aerial", match: /gpr|laser|uav|aerial|point cloud/i },
  { id: "gi", label: "Site investigation", match: /investigation|geotechn/i },
  { id: "general", label: "General", match: /.*/ },
];

function groupForLabel(label) {
  for (const g of SURVEY_GROUPS) {
    if (g.id === "general") continue;
    if (g.match.test(label)) return g.id;
  }
  return "general";
}

export default function SurveyTemplateEditor() {
  const { caps } = useApp();
  const canEdit = Boolean(caps?.orgSettings);
  const [rows, setRows] = useState(() => listSurveyTemplatesForEditor());
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState({ scope: "", methodology: "", equipmentUsed: "" });
  const [savedKey, setSavedKey] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(q) || r.key.includes(q));
  }, [rows, query]);

  const customCount = rows.filter((r) => r.hasOverride).length;

  const grouped = useMemo(() => {
    const map = Object.fromEntries(SURVEY_GROUPS.map((g) => [g.id, { ...g, items: [] }]));
    filtered.forEach((row) => {
      map[groupForLabel(row.label)].items.push(row);
    });
    return SURVEY_GROUPS.map((g) => map[g.id]).filter((g) => g.items.length);
  }, [filtered]);

  const openRow = (row) => {
    setExpanded(row.key);
    setDraft({
      scope: row.override?.scope ?? row.effective.scope ?? "",
      methodology: row.override?.methodology ?? row.effective.methodology ?? "",
      equipmentUsed: row.override?.equipmentUsed ?? row.effective.equipmentUsed ?? "",
    });
  };

  const persist = (key) => {
    saveSurveyTypeTemplateOverride(key, draft);
    setRows(listSurveyTemplatesForEditor());
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  };

  const reset = (key) => {
    resetSurveyTypeTemplateOverride(key);
    setRows(listSurveyTemplatesForEditor());
    if (expanded === key) {
      const row = listSurveyTemplatesForEditor().find((r) => r.key === key);
      if (row) {
        setDraft({
          scope: row.effective.scope || "",
          methodology: row.effective.methodology || "",
          equipmentUsed: row.effective.equipmentUsed || "",
        });
      }
    }
  };

  return (
    <div style={ss.card}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Survey type templates
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Override default scope, method and equipment text used when creating or smart-filling survey reports. Built-in defaults remain for fields you leave blank.
        {customCount ? ` · ${customCount} type${customCount === 1 ? "" : "s"} customised` : ""}
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter survey types…"
        style={{ ...ss.inp, marginBottom: 12, fontSize: 13 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {grouped.map((group) => (
          <div key={group.id}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8, letterSpacing: "0.04em" }}>
              {group.label.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {group.items.map((row) => (
          <div key={row.key} style={{ border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => (expanded === row.key ? setExpanded(null) : openRow(row))}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                border: "none",
                background: expanded === row.key ? "#f0fdfa" : "var(--color-background-primary,#fff)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <span>
                <strong style={{ fontSize: 13 }}>{row.label}</strong>
                {row.hasOverride ? (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#0f766e", fontWeight: 600 }}>Custom</span>
                ) : null}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{expanded === row.key ? "▲" : "▼"}</span>
            </button>
            {expanded === row.key ? (
              <div style={{ padding: "0 12px 12px" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Scope</label>
                <textarea
                  value={draft.scope}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, scope: e.target.value }))}
                  style={ss.ta}
                  rows={3}
                />
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Methodology</label>
                <textarea
                  value={draft.methodology}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, methodology: e.target.value }))}
                  style={ss.ta}
                  rows={3}
                />
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Equipment</label>
                <textarea
                  value={draft.equipmentUsed}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, equipmentUsed: e.target.value }))}
                  style={ss.ta}
                  rows={2}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={ss.btnP} disabled={!canEdit} onClick={() => persist(row.key)}>
                    {savedKey === row.key ? "Saved" : "Save override"}
                  </button>
                  <button type="button" style={ss.btn} disabled={!canEdit || !row.hasOverride} onClick={() => reset(row.key)}>
                    Reset to built-in
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
