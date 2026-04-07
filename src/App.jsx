import { useState, useEffect } from "react";
import { BarChart2, FileCheck, ClipboardList, Users, Menu } from "lucide-react";

import AnalyticsDashboard from "./components/AnalyticsDashboard";
import OrgSettings from "./components/OrgSettings";
import ClientPortal, { PublicClientPortalView } from "./components/ClientPortal";
import PermitSystem from "./modules/permits/PermitSystem";
import RAMSTemplateBuilder from "./modules/rams/RAMSTemplateBuilder";
import MethodStatement from "./modules/MethodStatement";
import CDMCompliance from "./modules/CDMCompliance";
import DailyBriefing from "./modules/DailyBriefing";
import QRInduction from "./modules/QRInduction";
import DigitalSignature from "./modules/DigitalSignature";
import Timesheet from "./modules/Timesheet";
import SnagRegister from "./modules/SnagRegister";
import COSHHRegister from "./modules/COSHHRegister";
import InspectionTracker from "./modules/InspectionTracker";
import RIDDORWizard from "./modules/RIDDORWizard";
import DocumentLibrary from "./modules/DocumentLibrary";
import Workers from "./modules/Workers";
import MonthlyReport from "./modules/MonthlyReport";
import WasteRegister from "./modules/WasteRegister";
import BackupExport from "./modules/BackupExport";
import AuditLogViewer from "./modules/AuditLogViewer";
import AIRamsGenerator from "./modules/AIRamsGenerator";
import ToolboxTalkAI from "./modules/ToolboxTalkAI";
import PhotoHazardAI from "./modules/PhotoHazardAI";
import DocumentTemplates from "./modules/DocumentTemplates";
import SubcontractorPortal, { PublicSubcontractorView } from "./modules/SubcontractorPortal";
import OfflineStatusBanner from "./offline/OfflineStatusBanner";
import NotificationSettings from "./offline/NotificationSettings";

const NAV_TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart2 },
  { id: "permits", label: "Permits", icon: FileCheck },
  { id: "rams", label: "RAMS", icon: ClipboardList },
  { id: "workers", label: "Workers", icon: Users },
  { id: "more", label: "More", icon: Menu },
];

const MORE_TABS = [
  { id: "method-statement", label: "Method statement" },
  { id: "cdm", label: "CDM compliance" },
  { id: "daily-briefing", label: "Daily briefing" },
  { id: "induction", label: "QR induction" },
  { id: "signatures", label: "Signatures" },
  { id: "timesheets", label: "Timesheets" },
  { id: "snags", label: "Snags" },
  { id: "coshh", label: "COSHH" },
  { id: "inspections", label: "Inspections" },
  { id: "riddor", label: "RIDDOR" },
  { id: "analytics", label: "Analytics" },
  { id: "monthly-report", label: "Monthly report" },
  { id: "waste", label: "Waste register" },
  { id: "templates", label: "Templates" },
  { id: "ai-rams", label: "AI RAMS" },
  { id: "ai-toolbox", label: "AI toolbox" },
  { id: "ai-photo", label: "AI photo hazard" },
  { id: "client-portal", label: "Client portal" },
  { id: "subcontractor", label: "Subcontractor" },
  { id: "documents", label: "Documents" },
  { id: "backup", label: "Backup" },
  { id: "audit", label: "Audit log" },
  { id: "settings", label: "Settings" },
];

const VIEW_COMPONENTS = {
  dashboard: AnalyticsDashboard,
  permits: PermitSystem,
  rams: RAMSTemplateBuilder,
  workers: Workers,
  "method-statement": MethodStatement,
  cdm: CDMCompliance,
  "daily-briefing": DailyBriefing,
  induction: QRInduction,
  signatures: DigitalSignature,
  timesheets: Timesheet,
  snags: SnagRegister,
  coshh: COSHHRegister,
  inspections: InspectionTracker,
  riddor: RIDDORWizard,
  analytics: AnalyticsDashboard,
  "monthly-report": MonthlyReport,
  waste: WasteRegister,
  templates: DocumentTemplates,
  "ai-rams": AIRamsGenerator,
  "ai-toolbox": ToolboxTalkAI,
  "ai-photo": PhotoHazardAI,
  "client-portal": ClientPortal,
  subcontractor: SubcontractorPortal,
  documents: DocumentLibrary,
  backup: BackupExport,
  audit: AuditLogViewer,
};

function SettingsView() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <OrgSettings />
      <div style={{ marginTop: 24 }}>
        <NotificationSettings />
      </div>
    </div>
  );
}

function AppShell() {
  const [navTab, setNavTab] = useState("dashboard");
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    if (!localStorage.getItem("mysafeops_orgId")) {
      localStorage.setItem("mysafeops_orgId", "default");
    }
  }, []);

  const goMainTab = (id) => {
    setNavTab(id);
    if (id !== "more") {
      setView(id);
    }
  };

  const selectMoreModule = (id) => {
    setView(id);
    setNavTab("more");
  };

  const MainComponent = VIEW_COMPONENTS[view] || AnalyticsDashboard;

  return (
    <div style={{ minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <OfflineStatusBanner />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 5rem" }}>
        {view === "settings" ? (
          <SettingsView />
        ) : (
          <MainComponent />
        )}
        {navTab === "more" && (
          <div
            style={{
              marginTop: 20,
              padding: "1rem",
              borderRadius: 12,
              border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
              background: "var(--color-background-primary,#fff)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 12 }}>
              More modules
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
                gap: 8,
              }}
            >
              {MORE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectMoreModule(t.id)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: "0.5px solid var(--color-border-secondary,#ccc)",
                    background: view === t.id ? "#E1F5EE" : "#fff",
                    fontSize: 12,
                    fontFamily: "DM Sans, sans-serif",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "8px 4px calc(8px + env(safe-area-inset-bottom))",
          background: "#fff",
          borderTop: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
          zIndex: 40,
        }}
      >
        {NAV_TABS.map((t) => {
          const Icon = t.icon;
          const active = navTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => goMainTab(t.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "6px 4px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: active ? "#0d9488" : "#64748b",
                fontSize: 10,
                fontFamily: "DM Sans, sans-serif",
                maxWidth: 88,
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  const qs = new URLSearchParams(window.location.search);
  const portal = qs.get("portal");
  const sub = qs.get("subcontractor");

  if (portal) {
    return (
      <div style={{ minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif", background: "#f8fafc" }}>
        <PublicClientPortalView token={portal} />
      </div>
    );
  }
  if (sub) {
    return (
      <div style={{ minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif", background: "#f8fafc" }}>
        <PublicSubcontractorView token={sub} />
      </div>
    );
  }

  return <AppShell />;
}
