import { useState, useEffect } from "react";
import { pushAudit } from "../utils/auditLog";
import { useToast } from "../context/ToastContext";
import { ms } from "../utils/moduleStyles";
import { countryOperationalStorageKey, loadOrgScoped as load, ORG_CHANGED_EVENT, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import { buildRamsCloneForProject } from "../utils/ramsDocumentClone";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "../utils/countryWorkspaces";
import PageHero from "../components/PageHero";
import { useWorkspaceT } from "../i18n/useWorkspaceT";

const genId = () => `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const ss = ms;
const TEMPLATE_KEY = "document_templates";
const readTemplates = () => ({ scope: countryOperationalStorageKey(TEMPLATE_KEY), rows: load(TEMPLATE_KEY, []) });

export function templatePayloadFromDocument(doc, type) {
  if (type === "rams") {
    const projectId = String(doc.projectId || "");
    const projects = projectId ? [{ id: projectId, name: doc.projectName || "", address: doc.location || "" }] : [];
    const prepared = buildRamsCloneForProject(doc, projectId, projects);
    const {
      id: _id, createdAt: _createdAt, updatedAt: _updatedAt,
      clonedFromRamsId: _sourceId, clonedFromProjectId: _sourceProjectId,
      createdBy: _createdBy, createdById: _createdById, createdByEmail: _createdByEmail,
      updatedBy: _updatedBy, updatedById: _updatedById, updatedByEmail: _updatedByEmail,
      ...payload
    } = prepared;
    return { ...payload, title: doc.title || "Untitled", documentNo: "", jobRef: "" };
  }
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = doc;
  return {
    ...payload,
    status: "draft",
    revision: "1A",
    approvedBy: "",
    permitControllerSignDate: "",
    operativeSignatures: {},
    signatures: [],
    deletedAt: undefined,
  };
}

export default function DocumentTemplates() {
  const { t } = useWorkspaceT();
  const { pushToast } = useToast();
  const [templateStore, setTemplateStore] = useState(readTemplates);
  const [name, setName] = useState("");
  const [type, setType] = useState("rams");
  const [sourceId, setSourceId] = useState("");
  const rams = liveOrgArrayRows(load("rams_builder_docs", []));
  const methodStmts = liveOrgArrayRows(load("method_statements", []));

  const templateScope = countryOperationalStorageKey(TEMPLATE_KEY);
  const templates = templateStore.scope === templateScope ? templateStore.rows : load(TEMPLATE_KEY, []);

  useEffect(() => {
    const onScopeChange = () => setTemplateStore(readTemplates());
    window.addEventListener(ORG_CHANGED_EVENT, onScopeChange);
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onScopeChange);
    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, onScopeChange);
      window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onScopeChange);
    };
  }, []);

  const persistTemplates = (next) => {
    if (countryOperationalStorageKey(TEMPLATE_KEY) !== templateScope || save(TEMPLATE_KEY, next) !== true) {
      alert("The template change could not be saved on this device. Check storage or workspace access and retry.");
      return false;
    }
    setTemplateStore({ scope: templateScope, rows: next });
    return true;
  };

  const capture = () => {
    if (!name.trim()) {
      pushToast({ type: "warn", title: "Template name required", message: "Enter a template name before saving." });
      return;
    }
    let payload = null;
    if (type === "rams") {
      const doc = rams.find((d) => d.id === sourceId);
      if (!doc) {
        pushToast({ type: "warn", title: "Select a document", message: "Choose a RAMS document to save as a template." });
        return;
      }
      payload = templatePayloadFromDocument(doc, type);
    } else {
      const doc = methodStmts.find((d) => d.id === sourceId);
      if (!doc) {
        pushToast({ type: "warn", title: "Select a document", message: "Choose a method statement to save as a template." });
        return;
      }
      payload = templatePayloadFromDocument(doc, type);
    }
    const next = [{ id: genId(), name: name.trim(), type, payload, createdAt: new Date().toISOString() }, ...load(TEMPLATE_KEY, [])];
    if (!persistTemplates(next)) return;
    pushToast({ type: "success", title: "Template saved", message: `"${name.trim()}" is ready to clone.` });
    setName("");
    pushAudit({ action: "template_save", entity: type, detail: name.trim() });
  };

  const deleteTemplate = (id) => {
    const victim = templates.find((x) => x.id === id);
    if (!victim) return;
    if (
      !softDeleteToRecycleBin({
        confirmMessage: "Delete template? It moves to Recycle Bin for 7 days.",
        moduleId: "document-templates",
        moduleLabel: "Document templates",
        itemType: "document_template",
        itemLabel: victim.name || id,
        sourceKey: "document_templates",
        payload: victim,
      })
    ) {
      return;
    }
    if (!persistTemplates(replaceWithTombstone(load(TEMPLATE_KEY, []), id))) return;
    pushAudit({ action: "template_delete", entity: victim.type, detail: victim.name });
  };

  const cloneToLive = (t) => {
    if (countryOperationalStorageKey(TEMPLATE_KEY) !== templateScope) {
      alert("The workspace changed. Reopen templates and retry.");
      return;
    }
    const newId = `${t.type === "rams" ? "rams" : "ms"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (t.type === "rams") {
      // A template can have been captured from an issued RAMS. Use the same
      // clone reset as the project-copy flow so signatures and share tokens
      // can never be carried into a new live document.
      const source = { ...t.payload, id: t.payload.id || t.id };
      const projectId = String(source.projectId || "");
      const projects = projectId
        ? [{ id: projectId, name: source.projectName || "", address: source.location || "" }]
        : [];
      const doc = {
        ...buildRamsCloneForProject(source, projectId, projects),
        id: newId,
        title: `${source.title || "Untitled"} (copy)`,
      };
      const list = load("rams_builder_docs", []);
      if (save("rams_builder_docs", [doc, ...list]) !== true) {
        alert("The RAMS draft could not be saved on this device. Check storage or workspace access and retry.");
        return;
      }
      pushAudit({ action: "template_clone", entity: t.type, detail: t.name });
      alert("Cloned to RAMS — open that module to edit.");
      return;
    } else {
      const doc = {
        ...t.payload,
        id: newId,
        title: (t.payload.title || "Untitled") + " (copy)",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "draft",
        revision: "1A",
        approvedBy: "",
        permitControllerSignDate: "",
        operativeSignatures: {},
        signatures: [],
      };
      const list = load("method_statements", []);
      if (save("method_statements", [doc, ...list]) !== true) {
        alert("The method statement draft could not be saved on this device. Check storage or workspace access and retry.");
        return;
      }
    }
    pushAudit({ action: "template_clone", entity: t.type, detail: t.name });
    alert(`Cloned to ${t.type === "rams" ? "RAMS" : "Method statements"} — open that module to edit.`);
  };

  const liveTemplates = liveOrgArrayRows(templates);

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
        <button
          type="button"
          style={{ ...ss.btnP, marginTop: 12, opacity: name.trim() && sourceId ? 1 : 0.55 }}
          disabled={!name.trim() || !sourceId}
          onClick={capture}
        >
          {t("save")}
        </button>
      </div>
      <div style={ss.card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Saved templates ({liveTemplates.length})</div>
        {liveTemplates.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>None yet.</div>
        ) : (
          liveTemplates.map((tpl) => (
            <div key={tpl.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #eee" }}>
              <div style={{ flex: "1 1 200px" }}>
                <strong>{tpl.name}</strong>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {tpl.type.toUpperCase()} · {new Date(tpl.createdAt).toLocaleDateString("en-GB")}
                </div>
              </div>
              <button type="button" style={ss.btnP} onClick={() => cloneToLive(tpl)}>
                Clone to new draft
              </button>
              <button type="button" style={ss.btn} onClick={() => deleteTemplate(tpl.id)}>
                {t("delete")}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
