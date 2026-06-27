import { useEffect, useMemo, useState } from "react";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import { ORG_SETTINGS_UPDATED_EVENT } from "../utils/orgSettingsStorage";
import { ORG_CHANGED_EVENT } from "../utils/orgStorage";
import {
  buildOrgBrandingCssVars,
  formatOrgDisplayName,
  normalizeHex,
  orgHasCustomBranding,
  shadeHex,
} from "../utils/orgBrandingTheme";

/** Live org branding for any tenant (logo, colours, display name). */
export function useOrgBranding() {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const bump = () => setRev((r) => r + 1);
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
    window.addEventListener(ORG_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
      window.removeEventListener(ORG_CHANGED_EVENT, bump);
    };
  }, []);

  return useMemo(() => {
    const org = getOrgSettings();
    const primary = normalizeHex(org.primaryColor);
    const cssVars = buildOrgBrandingCssVars(org);
    const displayName = formatOrgDisplayName(org.name);
    return {
      org,
      displayName,
      logo: org.logo || null,
      primaryColor: primary,
      accentColor: normalizeHex(org.accentColor, "#f97316"),
      cssVars,
      hasCustomBranding: orgHasCustomBranding(org),
      badgeGradient: `linear-gradient(145deg, ${shadeHex(primary, 0.22)} 0%, ${primary} 48%, ${shadeHex(primary, -0.18)} 100%)`,
      badgeShadow: `0 6px 16px ${primary}59`,
    };
  }, [rev]);
}
