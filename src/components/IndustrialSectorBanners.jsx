import { useEffect, useMemo, useState } from "react";
import { loadOrgScoped as load } from "../utils/orgStorage";
import { activeAllergenWindows, orgHasFoodIndustrialPack, orgHasPharmaPack } from "../utils/industrialSectors";
import { openWorkspaceView } from "../utils/workspaceNavContext";

const ALLERGEN_KEY = "allergen_changeover_windows";

const bannerBtn = {
  marginTop: 10,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #86EFAC",
  background: "#fff",
  color: "#14532D",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "DM Sans, system-ui, sans-serif",
  minHeight: 40,
};

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
            padding: "12px 14px",
            borderRadius: "var(--radius-sm, 10px)",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            color: "#14532D",
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: "DM Sans, system-ui, sans-serif",
          }}
        >
          <strong style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Pharma sector enabled</strong>
          <p style={{ margin: "0 0 8px" }}>
            Your organisation profile includes <strong>pharmaceutical / GMP-controlled</strong> work — manufacturing or
            maintenance where procedures, batch records and quality approval matter (not just general construction safety).
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>GMP</strong> (Good Manufacturing Practice) means following validated methods and specs. When something
            goes off-plan — wrong material, skipped step, out-of-limit reading, unapproved change — record it in the{" "}
            <strong>GMP deviation log</strong>: what happened, immediate action, who in QA was notified, and any CAPA
            reference. Use that register instead of the general incident log for QA-controlled deviations.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#166534" }}>
            Related registers: high-care access, CIP sign-off, allergen changeovers (where food/pharma overlap).
          </p>
          <button type="button" style={bannerBtn} onClick={() => openWorkspaceView({ viewId: "gmp-deviations" })}>
            Open GMP deviation log
          </button>
        </div>
      )}
    </div>
  );
}
