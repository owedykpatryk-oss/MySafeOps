import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);

const ROLES = ["admin", "supervisor", "operative"];

export function AppProvider({ children }) {
  const orgId = localStorage.getItem("mysafeops_orgId") || "default";
  const rk = `mysafeops_role_${orgId}`;

  const [role, setRoleState] = useState(() => {
    const r = localStorage.getItem(rk);
    return ROLES.includes(r) ? r : "admin";
  });

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

  const value = useMemo(() => ({ role, setRole, caps, orgId, ROLES }), [role, setRole, caps, orgId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
