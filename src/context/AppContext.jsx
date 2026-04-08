import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ORG_CHANGED_EVENT, getOrgId } from "../utils/orgStorage";
import { getBillingEntitlements, getTrialStatus } from "../utils/orgMembership";

const Ctx = createContext(null);

const ROLES = ["admin", "supervisor", "operative"];

export function AppProvider({ children }) {
  const [orgId, setOrgIdState] = useState(() => getOrgId());
  const rk = `mysafeops_role_${orgId}`;

  const [role, setRoleState] = useState(() => {
    const r = localStorage.getItem(rk);
    return ROLES.includes(r) ? r : "admin";
  });
  const [trialStatus, setTrialStatus] = useState(() => getTrialStatus());
  const [billing, setBilling] = useState(() => getBillingEntitlements());

  useEffect(() => {
    const r = localStorage.getItem(rk);
    setRoleState(ROLES.includes(r) ? r : "admin");
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
    };
    window.addEventListener("mysafeops-org-updated", onOrgUpdated);
    return () => window.removeEventListener("mysafeops-org-updated", onOrgUpdated);
  }, []);

  useEffect(() => {
    localStorage.setItem(rk, role);
  }, [rk, role]);

  const setRole = useCallback((r) => {
    if (ROLES.includes(r)) setRoleState(r);
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
