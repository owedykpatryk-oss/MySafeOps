import { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  listMsTemplatesForEditor,
  saveMsStepTemplateOverride,
  resetMsStepTemplateOverride,
} from "../utils/msOrgTemplates";
import { ms } from "../utils/moduleStyles";

const ss = {
  ...ms,
  ta: { ...ms.inp, resize: "vertical", minHeight: 120, fontSize: 12, lineHeight: 1.45, fontFamily: "ui-monospace, monospace" },
};

export default function MsTemplateEditor() {
  const { caps } = useApp();
  const canEdit = Boolean(caps?.orgSettings);
  const [rows, setRows] = useState(() => listMsTemplatesForEditor());
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState("");
  const [savedKey, setSavedKey] = useState(null);

  const openRow = (row) => {
    setExpanded(row.key);
    const lines = row.override?.length ? row.override : row.effective;
    setDraft((lines || []).join("\n"));
  };

  const persist = (key) => {
    saveMsStepTemplateOverride(key, draft);
    setRows(listMsTemplatesForEditor());
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  };

  const reset = (key) => {
    resetMsStepTemplateOverride(key);
    setRows(listMsTemplatesForEditor());
    if (expanded === key) {
      const row = listMsTemplatesForEditor().find((r) => r.key === key);
      if (row) setDraft((row.effective || []).join("\n"));
    }
  };

  return (
    <div style={ss.card}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Method statement step templates
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Override default work-sequence steps used when loading templates in the method statement editor or applying project playbooks. One step per line.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
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
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
                  {row.effective.length} step{row.effective.length !== 1 ? "s" : ""}
                </span>
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{expanded === row.key ? "▲" : "▼"}</span>
            </button>
            {expanded === row.key ? (
              <div style={{ padding: "0 12px 12px" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, margin: "8px 0 4px" }}>Steps (one per line)</label>
                <textarea
                  value={draft}
                  disabled={!canEdit}
                  onChange={(e) => setDraft(e.target.value)}
                  style={ss.ta}
                  rows={8}
                  spellCheck={false}
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
  );
}
