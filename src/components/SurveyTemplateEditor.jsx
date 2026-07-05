import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  listSurveyTemplatesForEditor,
  saveSurveyTypeTemplateOverride,
  resetSurveyTypeTemplateOverride,
  isSurveySimpleMode,
  setSurveySimpleMode,
} from "../utils/surveyOrgTemplates";
import { loadOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { LIMITATION_RULES } from "../modules/surveyReport/surveyReportConstants";
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

const EMPTY_DRAFT = {
  scope: "",
  methodology: "",
  equipmentUsed: "",
  recordsBoilerplate: "",
  executiveSummaryTemplate: "",
  recommendationsTemplate: "",
  defaultLimitationKeys: [],
  defaultDeliverableDescriptions: "",
};

function groupForLabel(label) {
  for (const g of SURVEY_GROUPS) {
    if (g.id === "general") continue;
    if (g.match.test(label)) return g.id;
  }
  return "general";
}

function draftFromRow(row) {
  const eff = row.effective || {};
  const ov = row.override || {};
  const pick = (key) => (ov[key] != null && ov[key] !== "" ? ov[key] : eff[key] ?? "");
  const deliverables = pick("defaultDeliverables");
  return {
    scope: pick("scope"),
    methodology: pick("methodology"),
    equipmentUsed: pick("equipmentUsed"),
    recordsBoilerplate: pick("recordsBoilerplate"),
    executiveSummaryTemplate: pick("executiveSummaryTemplate"),
    recommendationsTemplate: pick("recommendationsTemplate"),
    defaultLimitationKeys: Array.isArray(pick("defaultLimitationKeys")) ? [...pick("defaultLimitationKeys")] : [],
    defaultDeliverableDescriptions: Array.isArray(deliverables)
      ? deliverables.map((d) => d.description).filter(Boolean).join("\n")
      : "",
  };
}

function draftToOverrideFields(draft) {
  const out = { ...draft };
  const lines = String(draft.defaultDeliverableDescriptions || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  delete out.defaultDeliverableDescriptions;
  if (lines.length) {
    out.defaultDeliverables = lines.map((description, i) => ({
      id: `del_org_${i}`,
      format: "report_pdf",
      description,
      crs: "OSGB36",
      status: "Issued with report",
    }));
  }
  return out;
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        background: value ? "#0d9488" : "var(--color-border-secondary,#ccc)",
        position: "relative",
        transition: "background .2s",
        flexShrink: 0,
        border: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 20 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .2s",
        }}
      />
    </button>
  );
}

export default function SurveyTemplateEditor() {
  const { caps } = useApp();
  const canEdit = Boolean(caps?.orgSettings);
  const [rows, setRows] = useState(() => listSurveyTemplatesForEditor());
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savedKey, setSavedKey] = useState(null);
  const [query, setQuery] = useState("");
  const [simpleMode, setSimpleMode] = useState(() => isSurveySimpleMode(loadOrgSettingsRaw()));

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
    setDraft(draftFromRow(row));
  };

  const persist = (key) => {
    saveSurveyTypeTemplateOverride(key, draftToOverrideFields(draft));
    setRows(listSurveyTemplatesForEditor());
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  };

  const reset = (key) => {
    resetSurveyTypeTemplateOverride(key);
    setRows(listSurveyTemplatesForEditor());
    if (expanded === key) {
      const row = listSurveyTemplatesForEditor().find((r) => r.key === key);
      if (row) setDraft(draftFromRow(row));
    }
  };

  const toggleLimitation = (key) => {
    setDraft((d) => {
      const keys = new Set(d.defaultLimitationKeys || []);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      return { ...d, defaultLimitationKeys: [...keys] };
    });
  };

  const handleSimpleMode = (enabled) => {
    setSimpleMode(enabled);
    setSurveySimpleMode(enabled);
  };

  return (
    <div style={ss.card}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Survey editor & templates
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
          padding: "10px 12px",
          borderRadius: 8,
          border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
          background: "#f8fafc",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Simple survey mode</div>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.45, maxWidth: 520 }}>
            Four steps (Mobilise → Site → Findings → Issue) with Smart fill all upfront. Advanced tabs and tools stay available under Advanced.
          </p>
        </div>
        <Toggle value={simpleMode} onChange={handleSimpleMode} disabled={!canEdit} />
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Override default scope, method, equipment and extended prebuild text used when creating or smart-filling survey reports. Built-in catalog defaults remain for fields you leave blank.
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
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Records review boilerplate</label>
                      <textarea
                        value={draft.recordsBoilerplate}
                        disabled={!canEdit}
                        onChange={(e) => setDraft((d) => ({ ...d, recordsBoilerplate: e.target.value }))}
                        style={ss.ta}
                        rows={2}
                        placeholder="Desktop records search text applied on smart fill…"
                      />
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Executive summary template</label>
                      <textarea
                        value={draft.executiveSummaryTemplate}
                        disabled={!canEdit}
                        onChange={(e) => setDraft((d) => ({ ...d, executiveSummaryTemplate: e.target.value }))}
                        style={ss.ta}
                        rows={2}
                        placeholder="Use {site} and {date} placeholders…"
                      />
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Recommendations template</label>
                      <textarea
                        value={draft.recommendationsTemplate}
                        disabled={!canEdit}
                        onChange={(e) => setDraft((d) => ({ ...d, recommendationsTemplate: e.target.value }))}
                        style={ss.ta}
                        rows={2}
                      />
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "10px 0 6px" }}>Default limitation presets</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {LIMITATION_RULES.map((rule) => {
                          const on = (draft.defaultLimitationKeys || []).includes(rule.key);
                          return (
                            <button
                              key={rule.key}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => toggleLimitation(rule.key)}
                              style={{
                                ...ss.btn,
                                fontSize: 10,
                                padding: "4px 8px",
                                background: on ? "#ccfbf1" : undefined,
                                borderColor: on ? "#0d9488" : undefined,
                              }}
                            >
                              {rule.label}
                            </button>
                          );
                        })}
                      </div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "10px 0 4px" }}>Default deliverables (one per line)</label>
                      <textarea
                        value={draft.defaultDeliverableDescriptions}
                        disabled={!canEdit}
                        onChange={(e) => setDraft((d) => ({ ...d, defaultDeliverableDescriptions: e.target.value }))}
                        style={ss.ta}
                        rows={3}
                        placeholder={"Survey report (PDF)\nUtility mark-up drawing"}
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
