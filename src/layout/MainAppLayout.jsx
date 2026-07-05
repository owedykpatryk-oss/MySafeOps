import { useState, useEffect, useLayoutEffect, useCallback, useMemo, lazy, Suspense, memo, startTransition } from "react";
import "../styles/workspace.css";
import "../styles/workspace-more.css";
import { useSearchParams } from "react-router-dom";
import { BarChart2, FileCheck, ClipboardList, Users, Building2, Menu, Pin, Shield, Trash2, FileDown, EyeOff, Sparkles, Zap } from "lucide-react";

import OfflineStatusBanner from "../offline/OfflineStatusBanner";
import IndustrialSectorBanners from "../components/IndustrialSectorBanners";
import TrialBillingBanner from "../components/TrialBillingBanner";
import BillingReadOnlyBanner from "../components/BillingReadOnlyBanner";
import BillingUsageWarning from "../components/BillingUsageWarning";
import WorkspaceAppBar from "../components/WorkspaceAppBar";
import RouteErrorBoundary from "../components/RouteErrorBoundary";
import { ViewFallback } from "../components/ViewFallback";
import { RegisterPdfExportProvider } from "../context/RegisterPdfExportContext";
import { prefetchView, cancelPrefetchView } from "../viewPrefetch";
import {
  setWorkspaceNavTarget,
  OPEN_WORKSPACE_SETTINGS_EVENT,
  OPEN_WORKSPACE_VIEW_EVENT,
  OPEN_WORKSPACE_MORE_EVENT,
  WORKSPACE_SETTINGS_TAB_IDS,
} from "../utils/workspaceNavContext";
import { getModuleTilePresentation, tileSmartLine } from "../utils/moduleTileIntelligence";
import {
  MORE_SECTIONS,
  MORE_TABS,
  NAV_TAB_IDS,
  getMoreTabsForSection,
  filterModuleTabsByQuery,
  primaryBottomNavIdSet,
  PRIMARY_BOTTOM_NAV_IDS,
} from "../navigation/appModules";
import { getPinnedModuleIds, togglePinnedModule } from "../utils/pinnedModules";
import { getSectionTone, getModuleIcon, canExportModulePdf, preloadModuleIcons } from "../navigation/moduleCatalogMeta";
import { recordRecentModule } from "../utils/recentModules";
import { workspaceViewLoaders, workspaceViewComponents, DEFAULT_WORKSPACE_VIEW_ID } from "../navigation/workspaceViews";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useApp } from "../context/AppContext";
import { isSuperAdminEmail } from "../utils/superAdmin";
import { useOrgBranding } from "../hooks/useOrgBranding";
import {
  filterVisibleModuleIds,
  filterVisibleModuleTabs,
  getHiddenModuleIds,
  getModuleLabel,
  hideModule,
  HIDDEN_MODULES_UPDATED_EVENT,
  isModuleVisible,
} from "../utils/hiddenModules";
import { ORG_SETTINGS_UPDATED_EVENT, loadOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { isOnboardingWizardComplete } from "../utils/workspaceOnboarding";
import {
  filterTabsByRegisterStat,
  getRegisterStatsMap,
  invalidateRegisterStatsCache,
  HSE_SECTION_TITLE,
  SITE_SECTION_TITLE,
  registerStatMetaLine,
  sortTabsByRegisterPriority,
} from "../utils/moduleRegisterStats";
import MoreSectionSpotlight from "../components/MoreSectionSpotlight";
import MorePanelCommandCentre from "../components/MorePanelCommandCentre";
import ModuleTileSparkline from "../components/ModuleTileSparkline";
import { useToast } from "../context/ToastContext";
import { ORG_CHANGED_EVENT, ORG_DATA_CHANGED_EVENT } from "../utils/orgStorage";
import { BILLING_WRITE_BLOCKED_EVENT, billingWriteBlockedMessage } from "../utils/billingAccess";
import {
  BOTTOM_NAV_SHORTCUT_UPDATED_EVENT,
  DEFAULT_BOTTOM_NAV_FALLBACK_ID,
  isBottomNavOccupiedId,
  resolveBottomNavSlotId,
  setBottomNavModuleId,
} from "../utils/bottomNavShortcut";

const LAST_VIEW_STORAGE_KEY = "mysafeops_last_workspace_view";
const WORKSPACE_LAYOUT_VIEW_IDS = new Set([...Object.keys(workspaceViewLoaders), "settings"]);

function isEditableSurfaceTarget(target) {
  if (!target || typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest?.("input, textarea, select, [contenteditable='true']"));
}

const LazySettingsCenter = lazy(() => import("../components/SettingsCenter"));
const LazyWorkspaceSearchPalette = lazy(() => import("../components/WorkspaceSearchPalette"));
const LazyWorkspaceOnboarding = lazy(() => import("../components/WorkspaceOnboarding"));
const LazyTrialExpiredModal = lazy(() => import("../components/TrialExpiredModal"));

const MORE_COMPACT_KEY = "mysafeops_more_compact_v1";

function loadMoreCompactMode() {
  try {
    return localStorage.getItem(MORE_COMPACT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMoreCompactMode(value) {
  try {
    localStorage.setItem(MORE_COMPACT_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const MoreModuleTile = memo(function MoreModuleTile({
  tab,
  active,
  pinnedIds,
  sectionTone,
  stat,
  compactMode,
  onOpen,
  onTogglePin,
  onExportPdf,
  onHide,
  canHide,
}) {
  const isPinned = pinnedIds.includes(tab.id);
  const Icon = getModuleIcon(tab.id);
  const exportable = canExportModulePdf(tab.id);
  const meta = stat ? registerStatMetaLine(stat) : "";
  const statusClass = stat?.status && stat.status !== "unknown" ? ` app-more-tile-wrap--${stat.status}` : "";
  const presentation = useMemo(() => getModuleTilePresentation(tab.id, stat), [tab.id, stat]);
  const smartLine = tileSmartLine(presentation);
  const prebuild = presentation.prebuild;

  const runPrebuild = (e) => {
    e.stopPropagation();
    const viewId = prebuild?.viewId || tab.id;
    if (prebuild?.action) {
      setWorkspaceNavTarget({ viewId, action: prebuild.action });
    }
    onOpen(viewId);
  };

  const runSmartAction = (e) => {
    e.stopPropagation();
    const action = presentation.smartAction;
    if (!action) return;
    const viewId = action.viewId || tab.id;
    if (action.action) {
      setWorkspaceNavTarget({ viewId, action: action.action });
    }
    onOpen(viewId);
  };

  return (
    <div className={`app-more-tile-wrap app-more-tile-wrap--${sectionTone || "data"}${statusClass}${compactMode ? " app-more-tile-wrap--compact" : ""}`}>
      <div className="app-more-tile__glow" aria-hidden />
      <button
        type="button"
        className={`app-more-tile app-more-tile--v2${active ? " app-more-tile--active" : ""}`}
        onClick={() => onOpen(tab.id)}
        onMouseEnter={() => prefetchView(tab.id)}
        onMouseLeave={() => cancelPrefetchView(tab.id)}
        onFocus={() => prefetchView(tab.id)}
        onBlur={() => cancelPrefetchView(tab.id)}
      >
        {stat?.status === "attention" ? <span className="app-more-tile__pulse" aria-hidden /> : null}
        <span className="app-more-tile__icon" aria-hidden>
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span className="app-more-tile__body">
          <span className="app-more-tile__label">{tab.label}</span>
          {meta ? (
            <span className={`app-more-tile__meta app-more-tile__meta--${stat?.status || "unknown"}`}>{meta}</span>
          ) : null}
          {smartLine ? (
            <span className={`app-more-tile__smart app-more-tile__smart--${presentation.smartTone || "info"}`}>
              <Sparkles size={11} strokeWidth={2.2} aria-hidden />
              {smartLine}
              {presentation.smartAction ? (
                <button type="button" className="app-more-tile__smart-cta" onClick={runSmartAction}>
                  {presentation.smartAction.label} →
                </button>
              ) : null}
            </span>
          ) : null}
          {!compactMode && stat?.sparkline ? (
            <span className="app-more-tile__spark-row">
              <span className="app-more-tile__spark-label">7d activity</span>
              <ModuleTileSparkline sparkline={stat.sparkline} tone={stat.status} />
            </span>
          ) : null}
        </span>
        {stat?.count != null && (
          <span className={`app-more-tile__badge app-more-tile__badge--${stat.status}`} aria-hidden>
            {stat.count}
          </span>
        )}
      </button>
      <div className="app-more-tile__toolbar">
        {prebuild ? (
          <button
            type="button"
            className="app-more-tile-prebuild"
            title={prebuild.label}
            aria-label={`Quick start: ${prebuild.shortLabel}`}
            onClick={runPrebuild}
          >
            <Zap size={12} strokeWidth={2.4} aria-hidden />
            <span>{prebuild.shortLabel}</span>
          </button>
        ) : null}
        {exportable ? (
          <button
            type="button"
            className="app-more-tile-pdf app-more-tile-pdf--premium"
            aria-label={`Premium PDF — ${tab.label}`}
            title="Premium A4 PDF export"
            onClick={(e) => {
              e.stopPropagation();
              onExportPdf?.(tab.id, tab.label);
            }}
          >
            <FileDown size={13} strokeWidth={2.3} aria-hidden />
            <span>PDF</span>
          </button>
        ) : null}
        {canHide && onHide ? (
          <button
            type="button"
            className="app-more-tile-hide"
            aria-label={`Hide ${tab.label} from workspace`}
            title="Hide module (restore in Settings → Organisation → Modules)"
            onClick={(e) => {
              e.stopPropagation();
              onHide(tab.id);
            }}
          >
            <EyeOff size={13} strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className="app-more-tile-pin"
          data-active={isPinned}
          aria-label={isPinned ? "Remove from pinned shortcuts" : "Pin to shortcuts"}
          onClick={() => onTogglePin(tab.id)}
        >
          <Pin size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
});

function SettingsView({ initialTab, checkoutReturn }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<ViewFallback />}>
        <LazySettingsCenter initialTab={initialTab} checkoutReturn={checkoutReturn} />
      </Suspense>
    </RouteErrorBoundary>
  );
}

function readInitialSettingsQuery() {
  const qs = new URLSearchParams(window.location.search);
  const settingsTab = qs.get("settingsTab");
  const checkout = qs.get("checkout");
  const openBilling =
    settingsTab === "billing" || checkout === "success" || checkout === "canceled";
  if (openBilling) {
    return {
      openSettings: true,
      settingsInitialTab: "billing",
      checkoutReturn: checkout,
    };
  }
  if (settingsTab && WORKSPACE_SETTINGS_TAB_IDS.has(settingsTab)) {
    return {
      openSettings: true,
      settingsInitialTab: settingsTab,
      checkoutReturn: null,
    };
  }
  return {
    openSettings: false,
    settingsInitialTab: "cloud",
    checkoutReturn: null,
  };
}

function getInitialLayoutState() {
  const settingsQ = readInitialSettingsQuery();
  if (settingsQ.openSettings) {
    return {
      navTab: "more",
      view: "settings",
      settingsInitialTab: settingsQ.settingsInitialTab,
      checkoutReturn: settingsQ.checkoutReturn,
    };
  }
  const qs = new URLSearchParams(window.location.search);
  const viewParam = qs.get("view");
  if (viewParam === "settings") {
    return { navTab: "more", view: "settings", settingsInitialTab: "cloud", checkoutReturn: null };
  }
  if (viewParam && WORKSPACE_LAYOUT_VIEW_IDS.has(viewParam) && viewParam !== "settings") {
    if (!isModuleVisible(viewParam)) {
      return { navTab: "dashboard", view: "dashboard", settingsInitialTab: "cloud", checkoutReturn: null };
    }
    const nav = primaryBottomNavIdSet.has(viewParam) ? viewParam : "more";
    const permitId = qs.get("permitId");
    if (viewParam === "permits" && permitId) {
      setWorkspaceNavTarget({ viewId: "permits", permitId: String(permitId) });
    }
    return { navTab: nav, view: viewParam, settingsInitialTab: "cloud", checkoutReturn: null };
  }
  try {
    const last = sessionStorage.getItem(LAST_VIEW_STORAGE_KEY);
    if (last && WORKSPACE_LAYOUT_VIEW_IDS.has(last) && last !== "settings") {
      if (!isModuleVisible(last)) {
        return { navTab: "dashboard", view: "dashboard", settingsInitialTab: "cloud", checkoutReturn: null };
      }
      const nav = primaryBottomNavIdSet.has(last) ? last : "more";
      return { navTab: nav, view: last, settingsInitialTab: "cloud", checkoutReturn: null };
    }
  } catch {
    /* ignore */
  }
  return { navTab: "dashboard", view: "dashboard", settingsInitialTab: "cloud", checkoutReturn: null };
}

const NAV_ICONS = {
  dashboard: BarChart2,
  projects: Building2,
  permits: FileCheck,
  rams: ClipboardList,
  people: Users,
  bin: Trash2,
  superadmin: Shield,
  more: Menu,
};

/** Base bottom bar (More is last). Platform owner tab is inserted in layout when `isSuperadmin`. */
const NAV_TABS = NAV_TAB_IDS.map((t) => ({
  id: t.id,
  label: t.label,
  icon: NAV_ICONS[t.id] || NAV_ICONS.more,
}));

export default function MainAppLayout() {
  const { user } = useSupabaseAuth();
  const { caps } = useApp();
  const { pushToast } = useToast();
  const orgBranding = useOrgBranding();
  const isSuperadmin = isSuperAdminEmail(user?.email);
  const [hiddenRev, setHiddenRev] = useState(0);
  const [bottomSlotId, setBottomSlotId] = useState(() => resolveBottomNavSlotId());
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingWizardComplete());
  const hiddenModules = useMemo(() => {
    void hiddenRev;
    return getHiddenModuleIds();
  }, [hiddenRev]);
  const visibilityOpts = useMemo(() => ({ hiddenModules }), [hiddenModules]);

  useEffect(() => {
    const id = loadOrgSettingsRaw().bottomNavModuleId;
    if (typeof id === "string" && isBottomNavOccupiedId(id)) {
      setBottomNavModuleId(null);
    }
  }, []);

  useEffect(() => {
    const bump = () => setHiddenRev((r) => r + 1);
    const bumpSlot = () => setBottomSlotId(resolveBottomNavSlotId());
    const bumpOnboarding = () => setShowOnboarding(!isOnboardingWizardComplete());
    window.addEventListener(HIDDEN_MODULES_UPDATED_EVENT, bump);
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
    window.addEventListener(BOTTOM_NAV_SHORTCUT_UPDATED_EVENT, bumpSlot);
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, bumpSlot);
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, bumpOnboarding);
    return () => {
      window.removeEventListener(HIDDEN_MODULES_UPDATED_EVENT, bump);
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
      window.removeEventListener(BOTTOM_NAV_SHORTCUT_UPDATED_EVENT, bumpSlot);
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, bumpSlot);
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, bumpOnboarding);
    };
  }, []);

  const bottomNavTabs = useMemo(() => {
    const slotId = isBottomNavOccupiedId(bottomSlotId) ? DEFAULT_BOTTOM_NAV_FALLBACK_ID : bottomSlotId;
    let tabs = NAV_TABS.map((t) =>
      t.id === "bin"
        ? {
            ...t,
            navKey: "bin-slot",
            id: slotId,
            label: slotId === "bin" ? "Bin" : getModuleLabel(slotId),
            icon: NAV_ICONS[slotId] || getModuleIcon(slotId) || NAV_ICONS.bin,
          }
        : { ...t, navKey: t.id }
    );
    if (isSuperadmin) {
      const more = tabs[tabs.length - 1];
      const beforeMore = tabs.slice(0, -1);
      tabs = [...beforeMore, { id: "superadmin", navKey: "superadmin", label: "Owner", icon: NAV_ICONS.superadmin }, more];
    }
    const seen = new Set();
    return tabs.filter((t) => {
      if (t.id === "more") return isModuleVisible(t.id, visibilityOpts);
      if (!isModuleVisible(t.id, visibilityOpts)) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [isSuperadmin, visibilityOpts, bottomSlotId]);
  const primaryNavIdSet = useMemo(() => {
    const s = new Set(filterVisibleModuleIds(PRIMARY_BOTTOM_NAV_IDS, visibilityOpts));
    if (isSuperadmin) s.add("superadmin");
    return s;
  }, [isSuperadmin, visibilityOpts]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [layoutSeed] = useState(() => getInitialLayoutState());
  const [navTab, setNavTab] = useState(layoutSeed.navTab);
  const [view, setView] = useState(layoutSeed.view);
  const [settingsInitialTab, setSettingsInitialTab] = useState(layoutSeed.settingsInitialTab);
  const [billingCheckoutReturn, setBillingCheckoutReturn] = useState(layoutSeed.checkoutReturn);
  const [moreFilter, setMoreFilter] = useState("");
  const [moreSectionFilters, setMoreSectionFilters] = useState({});
  const [registerStatsTick, setRegisterStatsTick] = useState(0);
  const [moreCompact, setMoreCompact] = useState(() => loadMoreCompactMode());
  const [pendingMoreNav, setPendingMoreNav] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => getPinnedModuleIds());
  const allowedModuleIds = useMemo(() => {
    const base = isSuperadmin ? MORE_TABS : MORE_TABS.filter((t) => t.id !== "superadmin");
    return new Set(filterVisibleModuleTabs(base, visibilityOpts).map((t) => t.id));
  }, [isSuperadmin, visibilityOpts]);

  useEffect(() => {
    if (view === "settings" || view === "help") return;
    if (!isModuleVisible(view, visibilityOpts)) {
      setView("dashboard");
      setNavTab("dashboard");
    }
  }, [view, visibilityOpts]);

  const openHelpModule = useCallback(() => {
    setNavTab("more");
    setView("help");
  }, []);

  useEffect(() => {
    const onWriteBlocked = () => {
      pushToast({ type: "warning", message: billingWriteBlockedMessage(), title: "Read-only" });
    };
    window.addEventListener(BILLING_WRITE_BLOCKED_EVENT, onWriteBlocked);
    return () => window.removeEventListener(BILLING_WRITE_BLOCKED_EVENT, onWriteBlocked);
  }, [pushToast]);

  useEffect(() => {
    const bump = () => {
      invalidateRegisterStatsCache();
      setRegisterStatsTick((t) => t + 1);
    };
    window.addEventListener(ORG_CHANGED_EVENT, bump);
    window.addEventListener(ORG_DATA_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, bump);
      window.removeEventListener(ORG_DATA_CHANGED_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    const onOpenMore = (e) => {
      const sectionTitle = e.detail?.sectionTitle || HSE_SECTION_TITLE;
      const registerFilter = e.detail?.registerFilter || "all";
      setPendingMoreNav({ sectionTitle, registerFilter });
      setNavTab("more");
    };
    window.addEventListener(OPEN_WORKSPACE_MORE_EVENT, onOpenMore);
    return () => window.removeEventListener(OPEN_WORKSPACE_MORE_EVENT, onOpenMore);
  }, []);

  useEffect(() => {
    if (navTab !== "more" || !pendingMoreNav) return;
    setMoreSectionFilters((prev) => ({ ...prev, [pendingMoreNav.sectionTitle]: pendingMoreNav.registerFilter }));
    setPendingMoreNav(null);
    window.requestAnimationFrame(() => {
      const tone = getSectionTone(pendingMoreNav.sectionTitle);
      document.querySelector(`.app-more-section--${tone}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [navTab, pendingMoreNav]);

  useEffect(() => {
    const preload = () => {
      preloadModuleIcons();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(preload, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(preload, 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get("view") === view) return prev;
        next.set("view", view);
        return next;
      },
      { replace: true }
    );
    try {
      if (view !== "settings") {
        sessionStorage.setItem(LAST_VIEW_STORAGE_KEY, view);
      }
    } catch {
      /* ignore */
    }
  }, [view, setSearchParams]);

  useEffect(() => {
    recordRecentModule(view);
  }, [view]);

  useEffect(() => {
    if (view !== "superadmin") return;
    if (isSuperadmin) return;
    setView("dashboard");
    setNavTab("dashboard");
  }, [view, isSuperadmin]);

  /** Bottom bar highlights "Owner" when URL / session restored superadmin with nav still on "more". */
  useLayoutEffect(() => {
    if (!isSuperadmin || view !== "superadmin" || navTab === "superadmin") return;
    setNavTab("superadmin");
  }, [isSuperadmin, view, navTab]);

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
      return;
    }
    if (settingsTab && WORKSPACE_SETTINGS_TAB_IDS.has(settingsTab)) {
      setView("settings");
      setNavTab("more");
      setSettingsInitialTab(settingsTab);
      setBillingCheckoutReturn(null);
      const next = new URLSearchParams(searchParams);
      next.delete("settingsTab");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onOpenSettings = (e) => {
      const raw = e.detail?.tab;
      const tab = raw && WORKSPACE_SETTINGS_TAB_IDS.has(raw) ? raw : "organisation";
      setSettingsInitialTab(tab);
      setBillingCheckoutReturn(null);
      setNavTab("more");
      setView("settings");
    };
    window.addEventListener(OPEN_WORKSPACE_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_WORKSPACE_SETTINGS_EVENT, onOpenSettings);
  }, []);

  useEffect(() => {
    const onOpenView = (e) => {
      const viewId = e.detail?.viewId;
      if (!viewId) return;
      if (!primaryNavIdSet.has(viewId) && !allowedModuleIds.has(viewId)) return;
      if (primaryNavIdSet.has(viewId)) {
        setNavTab(viewId);
        setView(viewId);
      } else {
        setView(viewId);
        setNavTab("more");
      }
    };
    window.addEventListener(OPEN_WORKSPACE_VIEW_EVENT, onOpenView);
    return () => window.removeEventListener(OPEN_WORKSPACE_VIEW_EVENT, onOpenView);
  }, [allowedModuleIds, primaryNavIdSet]);

  useEffect(() => {
    document.body.classList.add("mysafeops-app-bottom-nav");
    return () => document.body.classList.remove("mysafeops-app-bottom-nav");
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      if (main) main.focus({ preventScroll: true });
    });
  }, [view]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (isEditableSurfaceTarget(e.target)) return;
      if (e.key === "/" && !e.altKey) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        openHelpModule();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openHelpModule]);

  const navigateFromSearch = useCallback((hit) => {
    const {
      viewId,
      permitId,
      projectId,
      action,
      ramsId,
      reportId,
      snagId,
      methodStatementId,
      geoPhotoId,
      planId,
    } = hit || {};
    if (!viewId) return;
    if (!primaryNavIdSet.has(viewId) && !allowedModuleIds.has(viewId)) return;
    const target = { viewId };
    if (permitId) target.permitId = permitId;
    if (projectId) target.projectId = projectId;
    if (action) target.action = action;
    if (ramsId) target.ramsId = ramsId;
    if (reportId) target.reportId = reportId;
    if (snagId) target.snagId = snagId;
    if (methodStatementId) target.methodStatementId = methodStatementId;
    if (geoPhotoId) target.geoPhotoId = geoPhotoId;
    if (planId) target.planId = planId;
    setWorkspaceNavTarget(target);
    startTransition(() => {
      if (primaryNavIdSet.has(viewId)) {
        setNavTab(viewId);
        setView(viewId);
      } else {
        setView(viewId);
        setNavTab("more");
      }
    });
  }, [allowedModuleIds, primaryNavIdSet]);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.addEventListener) return undefined;
    const onMsg = (event) => {
      if (event.data?.type !== "NAVIGATE" || !event.data?.url) return;
      try {
        const u = new URL(event.data.url, window.location.origin);
        if (u.pathname !== "/app") return;
        const viewId = u.searchParams.get("view");
        if (!viewId || !WORKSPACE_LAYOUT_VIEW_IDS.has(viewId)) return;
        if (!primaryNavIdSet.has(viewId) && !allowedModuleIds.has(viewId)) return;

        const target = { viewId };
        const navKeys = [
          "permitId",
          "projectId",
          "action",
          "ramsId",
          "reportId",
          "snagId",
          "methodStatementId",
          "geoPhotoId",
          "planId",
          "briefingId",
          "cdmPackId",
          "timesheetEntryId",
        ];
        navKeys.forEach((key) => {
          const v = u.searchParams.get(key);
          if (v) target[key] = v;
        });
        setWorkspaceNavTarget(target);

        if (primaryNavIdSet.has(viewId)) {
          setNavTab(viewId);
          setView(viewId);
        } else {
          setView(viewId);
          setNavTab("more");
        }
        setSearchParams(Object.fromEntries(u.searchParams.entries()), { replace: true });
      } catch {
        /* ignore */
      }
    };
    sw.addEventListener("message", onMsg);
    return () => sw.removeEventListener("message", onMsg);
  }, [allowedModuleIds, primaryNavIdSet, setSearchParams]);

  const goMainTab = (id) => {
    if (id === "more") {
      startTransition(() => setNavTab("more"));
      return;
    }
    startTransition(() => {
      if (primaryNavIdSet.has(id)) {
        setNavTab(id);
        setView(id);
        return;
      }
      setView(id);
      setNavTab(id === bottomSlotId ? id : "more");
    });
  };

  const selectMoreModule = (id) => {
    if (!allowedModuleIds.has(id)) return;
    startTransition(() => {
      setView(id);
      setNavTab("more");
    });
  };

  const handleTogglePin = useCallback((moduleId) => {
    setPinnedIds(togglePinnedModule(moduleId));
  }, []);

  const handleHideModule = useCallback(
    (id) => {
      if (!caps?.orgSettings) return;
      if (
        !window.confirm(
          `Hide "${getModuleLabel(id)}" from More and navigation?\n\nYou can restore it anytime in Settings → Organisation → Modules.`
        )
      ) {
        return;
      }
      hideModule(id);
      if (view === id) {
        setView("dashboard");
        setNavTab("dashboard");
      }
    },
    [caps?.orgSettings, view]
  );

  const canHideModules = Boolean(caps?.orgSettings);

  const handleExportModulePdf = useCallback(async (moduleId, label) => {
    try {
      const { exportModuleRegisterPdf } = await import("../utils/moduleRegisterPdf");
      const result = await exportModuleRegisterPdf(moduleId, { label });
      if (!result.ok) pushToast({ type: "warn", message: "This module does not support quick PDF export yet." });
      else pushToast({ type: "success", message: `${label} PDF exported.` });
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Could not export PDF." });
    }
  }, [pushToast]);

  const handleExportAllHsePdf = useCallback(async () => {
    try {
      const { exportAllHseRegistersPdf } = await import("../utils/moduleRegisterPdf");
      const result = await exportAllHseRegistersPdf();
      if (!result.ok) pushToast({ type: "error", message: "Could not build HSE register pack PDF." });
      else pushToast({ type: "success", message: "HSE register pack PDF exported." });
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Could not export HSE pack." });
    }
  }, [pushToast]);

  const handleExportSectionPdf = useCallback(async (sectionTitle, tabs) => {
    const modules = tabs.filter((t) => canExportModulePdf(t.id)).map((t) => ({ id: t.id, label: t.label }));
    if (modules.length === 0) {
      pushToast({ type: "warn", message: "No registers in this section support PDF export yet." });
      return;
    }
    try {
      const { exportMoreSectionPdf } = await import("../utils/moduleRegisterPdf");
      await exportMoreSectionPdf({ title: sectionTitle, modules });
      pushToast({ type: "success", message: `${sectionTitle} PDF exported.` });
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Could not export section PDF." });
    }
  }, [pushToast]);

  const MainComponent = workspaceViewComponents[view] || workspaceViewComponents[DEFAULT_WORKSPACE_VIEW_ID];

  const visibleMoreTabs = useMemo(() => {
    const base = isSuperadmin ? MORE_TABS : MORE_TABS.filter((t) => t.id !== "superadmin");
    return filterVisibleModuleTabs(base, visibilityOpts);
  }, [isSuperadmin, visibilityOpts]);
  const visibleMoreSections = useMemo(
    () =>
      MORE_SECTIONS.map((section) => ({
        ...section,
        ids: section.ids.filter(
          (id) => (id !== "superadmin" || isSuperadmin) && isModuleVisible(id, visibilityOpts)
        ),
      })),
    [isSuperadmin, visibilityOpts]
  );
  const q = moreFilter.trim().toLowerCase();
  const pinnedTabsOrdered = pinnedIds.map((id) => visibleMoreTabs.find((t) => t.id === id)).filter(Boolean);
  const pinnedTabsFiltered = filterModuleTabsByQuery(pinnedTabsOrdered, moreFilter);
  const registerStatsMap = useMemo(() => {
    if (navTab !== "more") return {};
    return getRegisterStatsMap(visibleMoreTabs.map((t) => t.id));
  }, [navTab, visibleMoreTabs, registerStatsTick]);

  const commandCentreSiteTabs = useMemo(() => {
    const section = visibleMoreSections.find((s) => s.title === SITE_SECTION_TITLE);
    return section ? filterModuleTabsByQuery(getMoreTabsForSection(section), q) : [];
  }, [visibleMoreSections, q]);

  const commandCentreHseTabs = useMemo(() => {
    const section = visibleMoreSections.find((s) => s.title === HSE_SECTION_TITLE);
    return section ? filterModuleTabsByQuery(getMoreTabsForSection(section), q) : [];
  }, [visibleMoreSections, q]);

  return (
    <div
      className="app-workspace-root"
      style={{ ...orgBranding.cssVars, position: "relative", minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif" }}
    >
      <a href="#main-content" className="app-skip-link">
        Skip to main content
      </a>
      <OfflineStatusBanner />
      <div style={{ padding: "0 12px", maxWidth: 1200, margin: "0 auto" }}>
        <TrialBillingBanner />
        <BillingReadOnlyBanner />
        <BillingUsageWarning />
        <IndustrialSectorBanners />
      </div>
      <WorkspaceAppBar
        view={view}
        navTab={navTab}
        onGoDashboard={() => {
          setNavTab("dashboard");
          setView("dashboard");
        }}
        onOpenHelp={openHelpModule}
        onOpenSettings={() => selectMoreModule("settings")}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {searchOpen ? (
        <Suspense fallback={null}>
          <LazyWorkspaceSearchPalette
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            onNavigate={navigateFromSearch}
            allowSuperadmin={isSuperadmin}
          />
        </Suspense>
      ) : null}
      {showOnboarding ? (
        <Suspense fallback={null}>
          <LazyWorkspaceOnboarding onComplete={() => setShowOnboarding(false)} />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <LazyTrialExpiredModal />
        </Suspense>
      )}
      <main id="main-content" tabIndex={-1} className="app-workspace-main">
        <div className="app-module-shell">
          {view === "settings" ? (
            <SettingsView initialTab={settingsInitialTab} checkoutReturn={billingCheckoutReturn} />
          ) : (
            <RouteErrorBoundary>
              <RegisterPdfExportProvider viewId={view}>
                <Suspense fallback={<ViewFallback />}>
                  <MainComponent />
                </Suspense>
              </RegisterPdfExportProvider>
            </RouteErrorBoundary>
          )}
        </div>
        {navTab === "more" && (
          <div className="app-panel-surface app-more-panel" style={{ marginTop: 20, padding: "1.35rem 1.15rem 1.25rem" }}>
            <MorePanelCommandCentre
              siteTabs={commandCentreSiteTabs}
              hseTabs={commandCentreHseTabs}
              statsMap={registerStatsMap}
              onOpenModule={selectMoreModule}
            />
            <div className="app-more-panel__exports">
              <button
                type="button"
                className={`app-more-compact-toggle${moreCompact ? " app-more-compact-toggle--active" : ""}`}
                aria-pressed={moreCompact}
                onClick={() => {
                  const next = !moreCompact;
                  setMoreCompact(next);
                  saveMoreCompactMode(next);
                }}
              >
                {moreCompact ? "Expanded tiles" : "Compact tiles"}
              </button>
              <button type="button" className="app-more-section-pdf" onClick={handleExportAllHsePdf}>
                <FileDown size={14} strokeWidth={2.2} aria-hidden />
                Export all HSE registers (A4)
              </button>
              <button
                type="button"
                className="app-more-section-pdf"
                onClick={async () => {
                  try {
                    const { exportSiteOperationsRegistersPdf } = await import("../utils/moduleRegisterPdf");
                    const result = await exportSiteOperationsRegistersPdf();
                    if (!result.ok) pushToast({ type: "error", message: "Could not build site operations pack PDF." });
                    else pushToast({ type: "success", message: "Site operations pack PDF exported." });
                  } catch (e) {
                    pushToast({ type: "error", message: e?.message || "Could not export site pack." });
                  }
                }}
              >
                <FileDown size={14} strokeWidth={2.2} aria-hidden />
                Export site operations pack
              </button>
            </div>
            <p className="app-more-panel__hint">
              Smart suggestions on each tile · <strong>Quick start</strong> opens pre-built templates · <strong>PDF</strong> exports premium A4 registers (or module guide when empty). Pin favourites with the pin icon.
            </p>
            {pinnedTabsFiltered.length > 0 && (
              <div style={{ marginBottom: 18 }}>
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
                  Pinned shortcuts
                </div>
                <div className="app-more-grid">
                  {pinnedTabsFiltered.map((t) => (
                    <MoreModuleTile
                      key={`pin-${t.id}`}
                      tab={t}
                      active={view === t.id}
                      pinnedIds={pinnedIds}
                      sectionTone="pinned"
                      stat={registerStatsMap[t.id]}
                      compactMode={moreCompact}
                      onOpen={selectMoreModule}
                      onTogglePin={handleTogglePin}
                      onExportPdf={handleExportModulePdf}
                      onHide={handleHideModule}
                      canHide={canHideModules}
                    />
                  ))}
                </div>
              </div>
            )}
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
            {visibleMoreSections.map((section) => {
              const tone = getSectionTone(section.title);
              const allSectionTabs = filterModuleTabsByQuery(getMoreTabsForSection(section), q);
              let tabs = allSectionTabs;
              const sectionFilter = moreSectionFilters[section.title] || "all";
              if ((tone === "hse" || tone === "site" || tone === "insights" || tone === "data") && sectionFilter !== "all") {
                tabs = filterTabsByRegisterStat(tabs, registerStatsMap, sectionFilter);
              }
              if (tone === "hse" || tone === "site" || tone === "insights" || tone === "data") {
                tabs = sortTabsByRegisterPriority(tabs, registerStatsMap);
              }
              if (allSectionTabs.length === 0) return null;
              const exportableCount = allSectionTabs.filter((t) => canExportModulePdf(t.id)).length;
              return (
                <div key={section.title} className={`app-more-section app-more-section--${tone}`} style={{ marginBottom: 22 }}>
                  <div className="app-more-section-head">
                    <div className="app-more-section-head__title">
                      <span className={`app-more-section-accent app-more-section-accent--${tone}`} aria-hidden />
                      <span>{section.title}</span>
                      <span className="app-more-section-count">{allSectionTabs.length}</span>
                    </div>
                    {exportableCount > 0 && (
                      <button
                        type="button"
                        className="app-more-section-pdf"
                        onClick={() => handleExportSectionPdf(section.title, allSectionTabs)}
                      >
                        <FileDown size={14} strokeWidth={2.2} aria-hidden />
                        Premium section PDF
                      </button>
                    )}
                  </div>
                  <MoreSectionSpotlight
                    sectionTitle={section.title}
                    tone={tone}
                    tabs={allSectionTabs}
                    statsMap={registerStatsMap}
                    filter={sectionFilter}
                    onFilterChange={(key) =>
                      setMoreSectionFilters((prev) => ({ ...prev, [section.title]: key }))
                    }
                    onSeeded={() => {
                      invalidateRegisterStatsCache();
                      setRegisterStatsTick((t) => t + 1);
                    }}
                    onOpenModule={selectMoreModule}
                  />
                  {tabs.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 2px 8px" }}>
                      No registers match this filter.
                    </div>
                  ) : (
                  <div className="app-more-grid">
                    {tabs.map((t) => (
                      <MoreModuleTile
                        key={t.id}
                        tab={t}
                        active={view === t.id}
                        pinnedIds={pinnedIds}
                        sectionTone={tone}
                        stat={registerStatsMap[t.id]}
                        compactMode={moreCompact}
                        onOpen={selectMoreModule}
                        onTogglePin={handleTogglePin}
                        onExportPdf={handleExportModulePdf}
                        onHide={handleHideModule}
                        canHide={canHideModules}
                      />
                    ))}
                  </div>
                  )}
                </div>
              );
            })}
            {visibleMoreSections.every((section) => filterModuleTabsByQuery(getMoreTabsForSection(section), q).length === 0) && (
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
        {bottomNavTabs.map((t) => {
          const Icon = t.icon || getModuleIcon(t.id);
          const active = navTab === t.id || view === t.id;
          return (
            <button
              key={t.navKey || t.id}
              type="button"
              className="app-bottom-nav__btn"
              aria-current={active ? "page" : undefined}
              aria-label={t.id === "superadmin" ? "Owner dashboard (platform owner only)" : undefined}
              title={t.id === "superadmin" ? "Platform owner dashboard — visible only on your account" : undefined}
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
                color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                fontSize: 11,
                fontFamily: "DM Sans, sans-serif",
                maxWidth: 78,
                fontWeight: 600,
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              <span className="app-bottom-nav__label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
