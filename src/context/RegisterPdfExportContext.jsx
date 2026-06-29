import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** @typedef {{ moduleId: string; rows: object[]; filterNote?: string | null }} RegisterPdfExportOverride */

const RegisterPdfExportContext = createContext(
  /** @type {null | { viewId: string | null; exportOverride: RegisterPdfExportOverride | null; setExportOverride: (v: RegisterPdfExportOverride | null) => void; clearExportOverride: () => void }} */ (
    null
  )
);

export function RegisterPdfExportProvider({ viewId, children }) {
  const [exportOverride, setExportOverride] = useState(/** @type {RegisterPdfExportOverride | null} */ (null));
  const clearExportOverride = useCallback(() => setExportOverride(null), []);
  const value = useMemo(
    () => ({ viewId, exportOverride, setExportOverride, clearExportOverride }),
    [viewId, exportOverride, clearExportOverride]
  );
  return <RegisterPdfExportContext.Provider value={value}>{children}</RegisterPdfExportContext.Provider>;
}

export function useRegisterPdfViewId() {
  return useContext(RegisterPdfExportContext)?.viewId ?? null;
}

export function useRegisterPdfExportState() {
  return useContext(RegisterPdfExportContext);
}

/**
 * When the user has filters active, PDF export uses these rows instead of the full org register.
 * @param {string | null | undefined} moduleId
 * @param {object[] | null | undefined} rows
 * @param {string | null | undefined} [filterNote]
 */
export function useRegisterPdfExportOverride(moduleId, rows, filterNote) {
  const setExportOverride = useContext(RegisterPdfExportContext)?.setExportOverride;
  const clearExportOverride = useContext(RegisterPdfExportContext)?.clearExportOverride;
  const rowsKey = useMemo(() => {
    if (!Array.isArray(rows)) return "";
    return `${rows.length}:${rows.map((r) => r?.id ?? "").join("|")}`;
  }, [rows]);

  useEffect(() => {
    if (!setExportOverride || !clearExportOverride || !moduleId || !Array.isArray(rows)) {
      return undefined;
    }
    setExportOverride({ moduleId, rows, filterNote: filterNote || null });
    return () => clearExportOverride();
  }, [moduleId, rowsKey, filterNote, setExportOverride, clearExportOverride, rows]);
}
