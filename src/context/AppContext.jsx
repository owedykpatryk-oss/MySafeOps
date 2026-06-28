import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isLocalWorkspaceOnly, hasPersistedSupabaseSession } from "../lib/authPrefs";
import { isSupabaseConfigured } from "../lib/supabase";
import { ORG_CHANGED_EVENT, getOrgId } from "../utils/orgStorage";
import { getBillingEntitlements, getTrialStatus } from "../utils/orgMembership";

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

/** Least privilege for signed-in cloud users; admin for offline / local-only workspaces. */
function defaultMembershipRole() {
  try {
    if (!isSupabaseConfigured() || isLocalWorkspaceOnly()) return "admin";
    if (!hasPersistedSupabaseSession()) return "admin";
  } catch {
    /* ignore */
  }
  return "operative";
}

function resolveMembershipRole() {
  return readMembershipRoleForCurrentOrg() || defaultMembershipRole();
}

export function AppProvider({ children }) {
  const [orgId, setOrgIdState] = useState(() => getOrgId());
  const rk = `mysafeops_role_${orgId}`;

  const [role, setRoleState] = useState(() => resolveMembershipRole());
  const [trialStatus, setTrialStatus] = useState(() => getTrialStatus());
  const [billing, setBilling] = useState(() => getBillingEntitlements());

  useEffect(() => {
    setRoleState(resolveMembershipRole());
  }, [rk]);

  useEffect(() => {
    const onOrgChanged = (event) => {
      const next = event?.detail?.orgId || getOrgId();
      setOrgIdState(String(next || "default"));
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
      const next = readMembershipRoleForCurrentOrg();
      if (next) setRoleState(next);
      else setRoleState(defaultMembershipRole());
    };
    window.addEventListener("mysafeops-org-updated", onOrgUpdated);
    return () => window.removeEventListener("mysafeops-org-updated", onOrgUpdated);
  }, []);

  const setRole = useCallback((r) => {
    if (!ROLES.includes(r)) return;
    // Role changes must come from cloud membership sync (persistOrgRow), not client self-elevation.
    if (isSupabaseConfigured() && !isLocalWorkspaceOnly()) return;
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
      roleManage: role === "admin" && (!isSupabaseConfigured() || isLocalWorkspaceOnly()),
    }),
    [role]
  );

  const value = useMemo(
    () => ({ role, setRole, caps, orgId, ROLES, trialStatus, billing }),
    [role, setRole, caps, orgId, trialStatus, billing]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
