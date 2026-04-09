import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart2, FileCheck, ClipboardList, Users, MapPin, Menu } from "lucide-react";

import OfflineStatusBanner from "../offline/OfflineStatusBanner";
import WorkspaceAppBar from "../components/WorkspaceAppBar";
import WorkspaceSearchPalette from "../components/WorkspaceSearchPalette";
import RouteErrorBoundary from "../components/RouteErrorBoundary";
import { prefetchView } from "../viewPrefetch";
import { setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import {
  MORE_SECTIONS,
  getMoreTabsForSection,
  filterModuleTabsByQuery,
  primaryBottomNavIdSet,
} from "../navigation/appModules";
import { workspaceViewComponents, DEFAULT_WORKSPACE_VIEW_ID } from "../navigation/workspaceViews";

const LazySettingsCenter = lazy(() => import("../components/SettingsCenter"));

export function ViewFallback() {
  return (
    <div className="app-view-fallback" style={{ fontFamily: "DM Sans, system-ui, sans-serif", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 14 }}>
      <div className="app-route-spinner" aria-hidden />
      Loading module…
    </div>
  );
}

function SettingsView({ initialTab, checkoutReturn }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<ViewFallback />}>
        <LazySettingsCenter initialTab={initialTab} checkoutReturn={checkoutReturn} />
      </Suspense>
    </RouteErrorBoundary>
  );
}

function readStripeReturnQuery() {
  const qs = new URLSearchParams(window.location.search);
  const settingsTab = qs.get("settingsTab");
  const checkout = qs.get("checkout");
  const openBilling =
    settingsTab === "billing" || checkout === "success" || checkout === "canceled";
  return {
    openSettings: openBilling,
    settingsInitialTab: openBilling ? "billing" : "cloud",
    checkoutReturn: checkout,
  };
}

const NAV_ICONS = {
  dashboard: BarChart2,
  permits: FileCheck,
  rams: ClipboardList,
  workers: Users,
  "site-map": MapPin,
  more: Menu,
};

const NAV_TABS = [
  { id: "dashboard", label: "Dashboard", icon: NAV_ICONS.dashboard },
  { id: "permits", label: "Permits", icon: NAV_ICONS.permits },
  { id: "rams", label: "RAMS", icon: NAV_ICONS.rams },
  { id: "workers", label: "Workers", icon: NAV_ICONS.workers },
  { id: "site-map", label: "Site map", icon: NAV_ICONS["site-map"] },
  { id: "more", label: "More", icon: NAV_ICONS.more },
];

export default function MainAppLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [navTab, setNavTab] = useState(() => (readStripeReturnQuery().openSettings ? "more" : "dashboard"));
  const [view, setView] = useState(() => (readStripeReturnQuery().openSettings ? "settings" : "dashboard"));
  const [settingsInitialTab, setSettingsInitialTab] = useState(() => readStripeReturnQuery().settingsInitialTab);
  const [billingCheckoutReturn, setBillingCheckoutReturn] = useState(() => readStripeReturnQuery().checkoutReturn);
  const [moreFilter, setMoreFilter] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const settingsTab = searchParams.get("settingsTab");
    const checkout = searchParams.get("checkout");
    if (settingsTab === "billing" || checkout === "success" || checkout === "canceled") {
      setView("settings");
      setNavTab("more");
      setSettingsInitialTab("billing");
      setBillingCheckoutReturn(checkout);
      const next = new URLSearchParams(searchParams);
      next.delete("settingsTab");
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    document.body.classList.add("mysafeops-app-bottom-nav");
    return () => document.body.classList.remove("mysafeops-app-bottom-nav");
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigateFromSearch = ({ viewId, permitId }) => {
    if (viewId === "permits" && permitId) {
      setWorkspaceNavTarget({ viewId: "permits", permitId });
    }
    if (primaryBottomNavIdSet.has(viewId)) {
      setNavTab(viewId);
      setView(viewId);
    } else {
      setView(viewId);
      setNavTab("more");
    }
  };

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

  const MainComponent = workspaceViewComponents[view] || workspaceViewComponents[DEFAULT_WORKSPACE_VIEW_ID];

  const q = moreFilter.trim().toLowerCase();

  return (
    <div style={{ position: "relative", minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <a href="#main-content" className="app-skip-link">
        Skip to main content
      </a>
      <OfflineStatusBanner />
      <WorkspaceAppBar
        view={view}
        navTab={navTab}
        onGoDashboard={() => {
          setNavTab("dashboard");
          setView("dashboard");
        }}
        onOpenHelp={() => selectMoreModule("help")}
        onOpenSettings={() => selectMoreModule("settings")}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <WorkspaceSearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigateFromSearch}
      />
      <main id="main-content" tabIndex={-1} className="app-workspace-main">
        <div className="app-module-shell">
          {view === "settings" ? (
            <SettingsView initialTab={settingsInitialTab} checkoutReturn={billingCheckoutReturn} />
          ) : (
            <RouteErrorBoundary>
              <Suspense fallback={<ViewFallback />}>
                <MainComponent />
              </Suspense>
            </RouteErrorBoundary>
          )}
        </div>
        {navTab === "more" && (
          <div className="app-panel-surface app-more-panel" style={{ marginTop: 20, padding: "1.35rem 1.15rem 1.25rem" }}>
            <div className="app-section-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              More modules
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
              Grouped by area. Use the filter to find a module quickly.
            </p>
            <input
              type="search"
              value={moreFilter}
              onChange={(e) => setMoreFilter(e.target.value)}
              placeholder="Filter modules…"
              aria-label="Filter more modules"
              className="app-more-filter"
              style={{
                width: "100%",
                maxWidth: 380,
                marginBottom: 16,
                padding: "12px 16px",
                borderRadius: "var(--radius-sm, 10px)",
                border: "1px solid var(--color-border-secondary,#cbd5e1)",
                fontSize: 14,
                fontFamily: "DM Sans, sans-serif",
                boxSizing: "border-box",
                minHeight: 44,
                background: "var(--color-background-primary)",
                boxShadow: "var(--shadow-sm)",
              }}
            />
            {MORE_SECTIONS.map((section) => {
              const tabs = filterModuleTabsByQuery(getMoreTabsForSection(section), q);
              if (tabs.length === 0) return null;
              return (
                <div key={section.title} style={{ marginBottom: 20 }}>
                  <div
                    className="app-section-label"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 8,
                    }}
                  >
                    {section.title}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(132px, 100%), 1fr))",
                      gap: 8,
                    }}
                  >
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="app-more-tile"
                        onClick={() => selectMoreModule(t.id)}
                        onMouseEnter={() => prefetchView(t.id)}
                        onFocus={() => prefetchView(t.id)}
                        style={{
                          padding: "12px 10px",
                          borderRadius: "var(--radius-sm, 10px)",
                          border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                          background: view === t.id ? "var(--color-accent-muted,#ccfbf1)" : "var(--color-background-primary)",
                          fontSize: 12,
                          fontWeight: view === t.id ? 600 : 500,
                          fontFamily: "DM Sans, sans-serif",
                          cursor: "pointer",
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minHeight: 44,
                          color: view === t.id ? "var(--color-accent-hover,#0f766e)" : "var(--color-text-primary)",
                          boxShadow: view === t.id ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {MORE_SECTIONS.every((section) => filterModuleTabsByQuery(getMoreTabsForSection(section), q).length === 0) && (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "8px 0" }}>
                No modules match your filter.
              </div>
            )}
          </div>
        )}
      </main>

      <nav
        className="app-bottom-nav"
        aria-label="Main navigation"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "8px 6px calc(8px + var(--safe-bottom, 0px))",
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
              className="app-bottom-nav__btn"
              aria-current={active ? "page" : undefined}
              onClick={() => goMainTab(t.id)}
              onMouseEnter={() => t.id !== "more" && prefetchView(t.id)}
              onFocus={() => t.id !== "more" && prefetchView(t.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "8px 6px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: active ? "#0d9488" : "#64748b",
                fontSize: 10,
                fontFamily: "DM Sans, sans-serif",
                maxWidth: 88,
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
