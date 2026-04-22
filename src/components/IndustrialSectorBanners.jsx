import { useEffect, useMemo, useState } from "react";
import { loadOrgScoped as load } from "../utils/orgStorage";
import { activeAllergenWindows, orgHasFoodIndustrialPack, orgHasPharmaPack } from "../utils/industrialSectors";

const ALLERGEN_KEY = "allergen_changeover_windows";

/**
 * Workspace banners: active allergen changeover windows; optional reminder when pharma sector enabled.
 */
export default function IndustrialSectorBanners() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const food = orgHasFoodIndustrialPack();
  const pharma = orgHasPharmaPack();

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 8000);
    return () => clearInterval(id);
  }, []);

  const windows = useMemo(() => {
    if (!food) return [];
    const raw = load(ALLERGEN_KEY, []);
    if (!Array.isArray(raw)) return [];
    return activeAllergenWindows(
      raw.map((w) => ({
        startAt: w.startAt,
        endAt: w.endAt,
        siteLabel: w.siteLabel,
        fromAllergen: w.fromAllergen,
        toAllergen: w.toAllergen,
        label: w.label,
        extraPpeHint: w.extraPpeHint,
      })),
      nowMs
    );
  }, [food, nowMs]);

  if (!food && !pharma) return null;

  return (
    <div role="region" aria-label="Industrial sector notices" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {windows.map((w, i) => (
        <div
          key={i}
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm, 10px)",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            color: "#713F12",
            fontSize: 13,
            lineHeight: 1.45,
            fontFamily: "DM Sans, system-ui, sans-serif",
          }}
        >
          <strong>Allergen changeover</strong>
          {w.label ? `: ${w.label}` : ""}
          {w.fromAllergen || w.toAllergen ? (
            <span>
              {" "}
              ({w.fromAllergen || "?"} → {w.toAllergen || "?"})
            </span>
          ) : null}
          {w.siteLabel ? <span> · {w.siteLabel}</span> : null}
          {w.extraPpeHint ? <div style={{ marginTop: 6, fontWeight: 500 }}>{w.extraPpeHint}</div> : null}
        </div>
      ))}
      {pharma && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-sm, 10px)",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            color: "#14532D",
            fontSize: 12,
            fontFamily: "DM Sans, system-ui, sans-serif",
          }}
        >
          Pharma sector enabled — use <strong>GMP deviation log</strong> for QA-controlled deviations.
        </div>
      )}
    </div>
  );
}
