import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { hasPersistedSupabaseSession, clearLocalWorkspaceOnlyFlag } from "../lib/authPrefs";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { ORG_CHANGED_EVENT, getOrgId } from "../utils/orgStorage";
import { scrubFessExclusiveOrgStorage } from "../utils/fessExclusive";
import { scrubUtilityMappingExclusiveOrgStorage } from "../utils/utilityMappingExclusive";
import { clearRamsHazardLibraryCache } from "../modules/rams/ramsHazardLibraryLoader";
import { getBillingEntitlements, getTrialExtensionCount, getTrialStatus, refreshMembershipRoleFromSupabase } from "../utils/orgMembership";
import {
  canExtendOrgTrial,
  isBillingWriteBlocked,
  isTrialExpiredWithoutPaid,
} from "../utils/billingAccess";

const Ctx = createContext(null);

const ROLES = ["admin", "supervisor", "operative"];

function readMembershipRoleForCurrentOrg() {
  try {
    const r = localStorage.getItem(`mysafeops_role_${getOrgId()}`);
    return ROLES.includes(r) ? r : null;
  } catch {
    return null;
  }
}

/** Signed-in cloud user — privileges come from membership RPC, never from localStorage flags. */
function isCloudAuthSession() {
  try {
    return Boolean(isSupabaseConfigured() && hasPersistedSupabaseSession());
  } catch {
    return false;
  }
}

function defaultMembershipRole() {
  try {
    // True device-only product (no Supabase env): full local admin.
    if (!isSupabaseConfigured()) return "admin";
    // Cloud configured but no session yet: fail closed (ProtectedAppRoute sends to login).
    if (hasPersistedSupabaseSession()) return "operative";
  } catch {
    /* ignore */
  }
  return "operative";
}

/**
 * Cloud sessions fail closed to operative — localStorage role is never trusted until
 * refreshMembershipRoleFromSupabase / persistOrgRow writes it and fires mysafeops-org-updated.
 */
function resolveMembershipRole() {
  if (isCloudAuthSession()) return "operative";
  if (!isSupabaseConfigured()) return readMembershipRoleForCurrentOrg() || "admin";
  return "operative";
}

export function AppProvider({ children }) {
  const [orgId, setOrgIdState] = useState(() => getOrgId());
  const rk = `mysafeops_role_${orgId}`;

  const [role, setRoleState] = useState(() => resolveMembershipRole());
  const [trialStatus, setTrialStatus] = useState(() => getTrialStatus());
  const [billing, setBilling] = useState(() => getBillingEntitlements());
  const [trialExtensionCount, setTrialExtensionCount] = useState(() => getTrialExtensionCount());

  useEffect(() => {
    setRoleState(resolveMembershipRole());
  }, [rk]);

  useEffect(() => {
    scrubFessExclusiveOrgStorage(getOrgId());
    scrubUtilityMappingExclusiveOrgStorage(getOrgId());
    if (isCloudAuthSession()) clearLocalWorkspaceOnlyFlag();
  }, []);

  useEffect(() => {
    const onOrgChanged = (event) => {
      const next = event?.detail?.orgId || getOrgId();
      setOrgIdState(String(next || "default"));
      scrubFessExclusiveOrgStorage(String(next || "default"));
      scrubUtilityMappingExclusiveOrgStorage(String(next || "default"));
      clearRamsHazardLibraryCache();
    };
    window.addEventListener(ORG_CHANGED_EVENT, onOrgChanged);
    return () => window.removeEventListener(ORG_CHANGED_EVENT, onOrgChanged);
  }, []);

  useEffect(() => {
    const sync = () => {
      const nextTrial = getTrialStatus();
      const nextBilling = getBillingEntitlements();
      setTrialStatus((prev) =>
        prev?.isActive === nextTrial?.isActive &&
        prev?.remainingDays === nextTrial?.remainingDays &&
        prev?.endsAtIso === nextTrial?.endsAtIso
          ? prev
          : nextTrial
      );
      setBilling((prev) =>
        prev?.subscriptionStatus === nextBilling?.subscriptionStatus && prev?.paidPlanId === nextBilling?.paidPlanId
          ? prev
          : nextBilling
      );
    };
    const id = window.setInterval(sync, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onOrgUpdated = () => {
      setTrialStatus(getTrialStatus());
      setBilling(getBillingEntitlements());
      setTrialExtensionCount(getTrialExtensionCount());
      const next = readMembershipRoleForCurrentOrg();
      if (next) setRoleState(next);
      else setRoleState(defaultMembershipRole());
    };
    window.addEventListener("mysafeops-org-updated", onOrgUpdated);
    return () => window.removeEventListener("mysafeops-org-updated", onOrgUpdated);
  }, []);

  /** Cloud: re-fetch role from Supabase so DevTools localStorage edits cannot persist. */
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return undefined;
    if (!hasPersistedSupabaseSession()) return undefined;
    clearLocalWorkspaceOnlyFlag();

    let cancelled = false;
    const syncRole = () => {
      if (cancelled || !hasPersistedSupabaseSession()) return;
      refreshMembershipRoleFromSupabase(supabase)
        .then((role) => {
          if (cancelled) return;
          if (role && ROLES.includes(role)) setRoleState(role);
        })
        .catch(() => {
          if (!cancelled) setRoleState("operative");
        });
    };

    syncRole();
    const onVisible = () => {
      if (document.visibilityState === "visible") syncRole();
    };
    window.addEventListener("focus", syncRole);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(syncRole, 5 * 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncRole);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [orgId]);

  const setRole = useCallback((r) => {
    if (!ROLES.includes(r)) return;
    // Role changes must come from cloud membership sync when Supabase is configured.
    if (isSupabaseConfigured()) return;
    setRoleState(r);
    try {
      localStorage.setItem(`mysafeops_role_${getOrgId()}`, r);
    } catch {
      /* ignore */
    }
  }, []);

  const caps = useMemo(
    () => ({
      deleteRecords: role !== "operative",
      orgSettings: role === "admin",
      backupImport: role === "admin",
      backupExport: true,
      bulkSnag: role !== "operative",
      subcontractorManage: role !== "operative",
      clientPortalManage: role !== "operative",
      roleManage: role === "admin" && !isSupabaseConfigured(),
    }),
    [role]
  );

  const billingAccess = useMemo(
    () => ({
      writeBlocked: isBillingWriteBlocked({ trialStatus, billing }),
      trialExpired: isTrialExpiredWithoutPaid({ trialStatus, billing }),
      canExtendTrial: canExtendOrgTrial({ trialStatus, billing, trialExtensionCount }),
      trialExtensionCount,
    }),
    [trialStatus, billing, trialExtensionCount]
  );

  const value = useMemo(
    () => ({
      role,
      setRole,
      caps,
      orgId,
      ROLES,
      trialStatus,
      billing,
      trialExtensionCount,
      billingAccess,
    }),
    [role, setRole, caps, orgId, trialStatus, billing, trialExtensionCount, billingAccess]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
