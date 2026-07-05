import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { checkBillingLimit } from "../utils/billingLimits";
import { openWorkspaceSettings } from "../utils/workspaceNavContext";
import InlineAlert from "./InlineAlert";

const WARN_RATIO = 0.8;

/**
 * Workspace banner when workers or projects approach plan caps (≥80%).
 */
export default function BillingUsageWarning() {
  const { trialStatus, billing, orgId } = useApp();

  const warnings = useMemo(() => {
    if (!orgId || orgId === "default") return [];
    const opts = { trialStatus, billing, isPlatformOwner: false };
    const out = [];
    for (const kind of ["projects", "workers"]) {
      const gate = checkBillingLimit(kind, opts);
      if (!gate.ok || gate.readOnly || !gate.limit) continue;
      const ratio = gate.count / gate.limit;
      if (ratio >= WARN_RATIO) {
        out.push({
          kind,
          count: gate.count,
          limit: gate.limit,
          pct: Math.round(ratio * 100),
          atCap: ratio >= 1,
        });
      }
    }
    return out;
  }, [trialStatus, billing, orgId]);

  if (!warnings.length) return null;

  const lines = warnings.map((w) => {
    const label = w.kind === "projects" ? "projects" : "workers";
    return w.atCap
      ? `${label}: ${w.count}/${w.limit} (limit reached)`
      : `${label}: ${w.count}/${w.limit} (${w.pct}% of plan)`;
  });

  return (
    <div style={{ marginBottom: 12 }}>
      <InlineAlert
        type={warnings.some((w) => w.atCap) ? "warn" : "info"}
        text={
          <>
            {warnings.some((w) => w.atCap) ? "Plan limit reached — " : "Approaching plan limit — "}
            {lines.join(" · ")}.{" "}
            <button
              type="button"
              onClick={() => openWorkspaceSettings({ tab: "billing" })}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "inherit",
                textDecoration: "underline",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 600,
              }}
            >
              View billing
            </button>
          </>
        }
      />
    </div>
  );
}
