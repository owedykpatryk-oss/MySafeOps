import { useEffect, useState } from "react";
import { ArrowRight, Building2, Camera, ClipboardCheck, FileText, MapPin, Plane, Radio, ShieldCheck } from "lucide-react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { countryOperationalStorageKey, loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { projectMissingItems } from "../utils/soloWorkspace";
import { isModuleVisible, HIDDEN_MODULES_UPDATED_EVENT } from "../utils/hiddenModules";
import { openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import "../styles/field-home.css";

const PROJECTS_KEY = "mysafeops_projects";
const REPORTS = [
  { id: "survey-report", title: "Survey report", detail: "Record observations, measurements and site evidence.", icon: ClipboardCheck, action: "createReport" },
  { id: "gpr-report", title: "GPR report", detail: "Start a scan report with this site's details.", icon: Radio },
  { id: "drone-operations", title: "Drone operations", detail: "Open missions, select the site and use the field workspace.", icon: Plane, global: true },
];
const DOCUMENTS = [
  { id: "rams", title: "RAMS", detail: "Read the current document and review signatures.", icon: ShieldCheck },
  { id: "permits", title: "Permits", detail: "Check the permit and its conditions before work.", icon: ClipboardCheck },
  { id: "daily-briefing", title: "Daily briefing", detail: "Review today's briefing with your team.", icon: FileText },
  { id: "emergency", title: "Emergency contacts", detail: "Find contacts and emergency arrangements.", icon: ShieldCheck },
];

/** A navigation surface over existing scoped registers; never creates a second copy of site data. */
export default function FieldHome() {
  const { user } = useSupabaseAuth();
  const selectionKey = `${countryOperationalStorageKey("field_site_selection")}:${user?.id || "local"}`;
  const [projects, setProjects] = useState(() => loadOrgScoped(PROJECTS_KEY, []));
  const [projectId, setProjectId] = useState(() => {
    try { return sessionStorage.getItem(selectionKey) || ""; } catch { return ""; }
  });
  const [section, setSection] = useState("today");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [, setVisibilityRevision] = useState(0);
  const sync = useD1OrgArraySync({ storageKey: PROJECTS_KEY, namespace: PROJECTS_KEY,
    value: projects, setValue: setProjects, load: loadOrgScoped, save: saveOrgScoped });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const visibility = () => setVisibilityRevision((n) => n + 1);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(HIDDEN_MODULES_UPDATED_EVENT, visibility);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(HIDDEN_MODULES_UPDATED_EVENT, visibility);
    };
  }, []);
  const sites = projects.filter((p) => p && !p.deletedAt);
  const project = sites.find((p) => p.id === projectId);
  const missing = project ? projectMissingItems(project) : [];
  const canProjects = isModuleVisible("projects");
  const open = (id, target = {}) => {
    if (!isModuleVisible(id)) return;
    // Overwrite any old one-shot target, including for register-level links.
    setWorkspaceNavTarget({ viewId: id, ...target });
    openWorkspaceView({ viewId: id });
  };
  const siteTarget = project ? { projectId: project.id } : {};
  const reportCards = REPORTS.filter((item) => isModuleVisible(item.id));
  const documentCards = DOCUMENTS.filter((item) => isModuleVisible(item.id));
  const renderCard = (item, onClick, disabled = false) => {
    const Icon = item.icon;
    return <button key={item.id} type="button" className="field-home__card" onClick={onClick} disabled={disabled}>
      <Icon size={25} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={20} aria-hidden="true" />
    </button>;
  };
  return <div className="field-home">
    <header className="field-home__hero">
      <span className="field-home__eyebrow">SITE WORKSPACE</span>
      <h2>Your day on site</h2>
      <p>Choose your site. Capture evidence, open reports and find the documents you need.</p>
      <span role="status" className="field-home__connection">{online ? "Internet connection available" : "Offline — using information on this device"}</span>
    </header>
    <D1ModuleSyncBanner {...sync} scopeLabel="Sites" />
    <div className="field-home__site-picker">
      <label htmlFor="field-site">Working site</label>
      <select id="field-site" value={project?.id || ""} onChange={(e) => {
        setProjectId(e.target.value);
        try { sessionStorage.setItem(selectionKey, e.target.value); } catch { /* Selection still works in memory. */ }
      }}>
        <option value="">Choose a site</option>
        {sites.map((p) => <option key={p.id} value={p.id}>{p.name || "Unnamed site"}{p.site ? ` — ${p.site}` : ""}</option>)}
      </select>
      {!sites.length && !sync.d1Hydrating && <p>No sites available on this device.{canProjects ? " Open Projects to add or sync a site." : " Ask your workspace administrator to set up your site."}</p>}
      {project && <p><MapPin size={16} aria-hidden="true" /> {[project.site, project.address, project.postcode].filter(Boolean).join(" · ") || "Site address has not been added."}</p>}
    </div>
    <nav className="field-home__tabs" aria-label="Site workspace">
      {[["today", "Today"], ["site", "Site"], ["capture", "Add"], ["documents", "Documents"]].map(([id, label]) =>
        <button type="button" key={id} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{label}</button>)}
    </nav>
    {(section === "today" || section === "capture") && <section aria-labelledby="field-capture-title">
      <h3 id="field-capture-title">Capture work on site</h3>
      {!project && <p className="field-home__hint">Choose a site above to attach new reports and photos to the right project.</p>}
      <div className="field-home__grid">
        {isModuleVisible("geo-photos") && renderCard({ id: "geo-photos", title: "Add site photos", detail: "Capture evidence and attach it to the selected site.", icon: Camera }, () => open("geo-photos", { ...siteTarget, action: "capture" }), !project)}
        {reportCards.map((item) => renderCard(item, () => open(item.id, item.global ? {} : { ...siteTarget, ...(item.action ? { action: item.action } : {}) }), !item.global && !project))}
      </div>
      <p className="field-home__hint">Check the save and upload status inside each report before leaving. An internet connection alone does not confirm that your work has synced.</p>
    </section>}
    {section === "today" && project && missing.length > 0 && <section className="field-home__readiness" aria-labelledby="field-readiness-title">
      <h3 id="field-readiness-title">Complete the site profile</h3>
      <p>Missing details: {missing.join(", ")}. Confirm these with your site team.</p>
      {canProjects && <button type="button" className="field-home__link" onClick={() => open("projects", { ...siteTarget, action: "viewProjectDashboard" })}>Review site details</button>}
    </section>}
    {section === "site" && <section aria-labelledby="field-site-title">
      <h3 id="field-site-title">{project?.name || "Your site"}</h3>
      {!project ? <p>Choose a site to view its details.</p> : <>
        <dl className="field-home__details"><dt>Site manager</dt><dd>{project.siteManager || "Not provided"}</dd><dt>Address</dt><dd>{[project.address, project.postcode].filter(Boolean).join(", ") || "Not provided"}</dd></dl>
        <div className="field-home__grid">
          {canProjects && renderCard({ id: "projects", title: "Site profile", detail: "Open this site's details, linked documents and readiness checks.", icon: Building2 }, () => open("projects", { ...siteTarget, action: "viewProjectDashboard" }))}
          {isModuleVisible("project-drawings") && renderCard({ id: "project-drawings", title: "Site plans", detail: "Open drawings for this site.", icon: MapPin }, () => open("project-drawings", siteTarget))}
        </div>
      </>}
      {!project && canProjects && <button type="button" className="field-home__link" onClick={() => open("projects")}>Open Projects</button>}
    </section>}
    {(section === "today" || section === "documents") && <section aria-labelledby="field-documents-title">
      <h3 id="field-documents-title">Before you start</h3>
      <p className="field-home__hint">These open workspace registers. Check the site, document version and approval status before signing or starting work.</p>
      <div className="field-home__grid">{documentCards.map((item) => renderCard(item, () => open(item.id)))}</div>
      {!documentCards.length && <p>No document modules are enabled for this workspace.</p>}
    </section>}
  </div>;
}
