import { createContext, useContext } from "react";

/** Current workspace view id — used by PageHero to offer register PDF export. */
const RegisterPdfExportContext = createContext(null);

export function RegisterPdfExportProvider({ viewId, children }) {
  return <RegisterPdfExportContext.Provider value={viewId}>{children}</RegisterPdfExportContext.Provider>;
}

export function useRegisterPdfViewId() {
  return useContext(RegisterPdfExportContext);
}
