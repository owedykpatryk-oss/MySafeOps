import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

export function AppProvider({ children }) {
  const [orgId, setOrgIdState] = useState(() => getOrgId());
  const rk = `mysafeops_role_${orgId}`;

  const [role, setRoleState] = useState(() => readMembershipRoleForCurrentOrg() || "admin");
  const [trialStatus, setTrialStatus] = useState(() => getTrialStatus());
  const [billing, setBilling] = useState(() => getBillingEntitlements());

  useEffect(() => {
    setRoleState(readMembershipRoleForCurrentOrg() || "admin");
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
      setTrialStatus(getTrialStatus());
      setBilling(getBillingEntitlements());
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
    };
    window.addEventListener("mysafeops-org-updated", onOrgUpdated);
    return () => window.removeEventListener("mysafeops-org-updated", onOrgUpdated);
  }, []);

  const setRole = useCallback((r) => {
    if (!ROLES.includes(r)) return;
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
      roleManage: true,
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
