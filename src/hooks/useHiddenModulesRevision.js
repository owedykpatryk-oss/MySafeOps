import { useEffect, useState } from "react";
import { HIDDEN_MODULES_UPDATED_EVENT } from "../utils/hiddenModules";
import { ORG_SETTINGS_UPDATED_EVENT } from "../utils/orgSettingsStorage";

/** Re-render when org hide list changes (Settings or More quick-hide). */
export function useHiddenModulesRevision() {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const bump = () => setRev((r) => r + 1);
    window.addEventListener(HIDDEN_MODULES_UPDATED_EVENT, bump);
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
    return () => {
      window.removeEventListener(HIDDEN_MODULES_UPDATED_EVENT, bump);
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
    };
  }, []);
  return rev;
}
