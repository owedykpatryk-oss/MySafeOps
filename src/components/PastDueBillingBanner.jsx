import { AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { isSubscriptionPastDueOrUnpaid, pastDueBillingMessage } from "../utils/billingAccess";
import { openWorkspaceSettings } from "../utils/workspaceNavContext";

/**
 * Org-level warning when Stripe reports past_due / unpaid — pay via Settings → Billing portal.
 */
export default function PastDueBillingBanner() {
  const { billing, role } = useApp();
  if (!isSubscriptionPastDueOrUnpaid(billing)) return null;

  const status = String(billing?.subscriptionStatus || "").toLowerCase();
  const isAdmin = role === "admin";

  return (
    <div className="app-trial-banner app-trial-banner--past-due" role="alert">
      <AlertTriangle size={18} aria-hidden />
      <div className="app-trial-banner__body">
        <strong>{status === "unpaid" ? "Payment required" : "Outstanding invoice"}</strong>
        <span>{pastDueBillingMessage(status)}</span>
      </div>
      <div className="app-trial-banner__actions">
        {isAdmin ? (
          <button
            type="button"
            className="app-trial-banner__btn app-trial-banner__btn--primary"
            onClick={() => openWorkspaceSettings({ tab: "billing" })}
          >
            Pay invoice
          </button>
        ) : (
          <span className="app-trial-banner__hint">Ask an organisation admin to update billing.</span>
        )}
      </div>
    </div>
  );
}
