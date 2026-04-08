import { useState, useEffect } from "react";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const ss = ms;

export default function DocumentTemplates() {
  const [templates, setTemplates] = useState(() => load("document_templates", []));
  const [name, setName] = useState("");
  const [type, setType] = useState("rams");
  const [sourceId, setSourceId] = useState("");
  const rams = load("rams_builder_docs", []);
  const methodStmts = load("method_statements", []);

  useEffect(() => {
    save("document_templates", templates);
  }, [templates]);

  const capture = () => {
    if (!name.trim()) return;
    let payload = null;
    if (type === "rams") {
      const doc = rams.find((d) => d.id === sourceId);
      if (!doc) {
        alert("Select a RAMS document");
        return;
      }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = doc;
      payload = rest;
    } else {
      const doc = methodStmts.find((d) => d.id === sourceId);
      if (!doc) {
        alert("Select a method statement");
        return;
      }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = doc;
      payload = rest;
    }
    setTemplates((p) => [{ id: genId(), name: name.trim(), type, payload, createdAt: new Date().toISOString() }, ...p]);
    setName("");
    pushAudit({ action: "template_save", entity: type, detail: name.trim() });
  };

  const cloneToLive = (t) => {
    const newId = `${t.type === "rams" ? "rams" : "ms"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const doc = {
      ...t.payload,
      id: newId,
      title: (t.payload.title || "Untitled") + " (copy)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
    };
    if (t.type === "rams") {
      const list = load("rams_builder_docs", []);
      save("rams_builder_docs", [doc, ...list]);
    } else {
      const list = load("method_statements", []);
      save("method_statements", [doc, ...list]);
    }
    pushAudit({ action: "template_clone", entity: t.type, detail: t.name });
    alert(`Cloned to ${t.type === "rams" ? "RAMS" : "Method statements"} — open that module to edit.`);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="TPL"
        title="Document templates"
        lead="Save a snapshot of an existing RAMS or method statement, then clone it as a new draft anytime."
      />
      <div style={{ ...ss.card, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Save from current library</div>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Template name</label>
        <input style={ss.inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard food factory pipework" />
        <label style={{ display: "block", fontSize: 12, margin: "10px 0 4px" }}>Type</label>
        <select style={ss.inp} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="rams">RAMS</option>
          <option value="ms">Method statement</option>
        </select>
        <label style={{ display: "block", fontSize: 12, margin: "10px 0 4px" }}>Source document</label>
        <select style={ss.inp} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">— choose —</option>
          {(type === "rams" ? rams : methodStmts).map((d) => (
            <option key={d.id} value={d.id}>
              {d.title || d.id}
            </option>
          ))}
        </select>
        <button type="button" style={{ ...ss.btnP, marginTop: 12 }} onClick={capture}>
          Save template
        </button>
      </div>
      <div style={ss.card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Saved templates ({templates.length})</div>
        {templates.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>None yet.</div>
        ) : (
          templates.map((t) => (
            <div key={t.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #eee" }}>
              <div style={{ flex: "1 1 200px" }}>
                <strong>{t.name}</strong>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {t.type.toUpperCase()} · {new Date(t.createdAt).toLocaleDateString("en-GB")}
                </div>
              </div>
              <button type="button" style={ss.btnP} onClick={() => cloneToLive(t)}>
                Clone to new draft
              </button>
              <button
                type="button"
                style={ss.btn}
                onClick={() => {
                  if (confirm("Delete template?")) setTemplates((p) => p.filter((x) => x.id !== t.id));
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
