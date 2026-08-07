import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Globe2, Plus } from "lucide-react";
import { useToast } from "../context/ToastContext";
import {
  COUNTRY_WORKSPACE_MARKETS,
  countryWorkspaceDefinition,
  createCountryWorkspace,
  ensureLegacyCountryWorkspace,
  loadCountryWorkspaces,
  pickActiveCountryWorkspace,
  setActiveCountryWorkspace,
  updateCountryWorkspaceDocumentLocale,
  workspaceHasPaidAccess,
} from "../utils/countryWorkspaces";
import "../styles/country-workspaces.css";

function billingStatus(workspace) {
  const status = String(workspace?.billing?.subscription_status || "none");
  if (status === "active" || status === "trialing") return { label: status === "trialing" ? "Trialing" : "Active", tone: "ok" };
  if (status === "past_due" || status === "unpaid") return { label: "Payment required", tone: "danger" };
  if (status === "incomplete") return { label: "Checkout incomplete", tone: "warn" };
  if (status === "canceled") return { label: "Cancelled", tone: "muted" };
  return { label: "Subscription required", tone: "muted" };
}

export default function CountryWorkspaceBilling({
  supabase,
  orgSlug,
  initialMarketId = "uk",
  isAdmin = false,
  stripeMode = "live",
  onWorkspaceChange,
}) {
  const { pushToast } = useToast();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [addingMarket, setAddingMarket] = useState(null);
  const [savingLocale, setSavingLocale] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        await ensureLegacyCountryWorkspace(supabase, initialMarketId, orgSlug);
      }
      const rows = await loadCountryWorkspaces(supabase, orgSlug, { stripeMode });
      const active = pickActiveCountryWorkspace(rows, orgSlug);
      setWorkspaces(rows);
      setActiveId(active?.id || null);
      onWorkspaceChange?.(active || null, rows);
    } catch (cause) {
      const message = cause?.message || "Could not load country workspaces.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [initialMarketId, isAdmin, onWorkspaceChange, orgSlug, stripeMode, supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const missingMarkets = useMemo(
    () => COUNTRY_WORKSPACE_MARKETS.filter((marketId) => !workspaces.some((workspace) => workspace.market_id === marketId)),
    [workspaces],
  );
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeId) || null;

  const chooseWorkspace = async (workspace, { revealPlans = false } = {}) => {
    const switchesCountry = workspace.id !== activeId;
    setActiveId(workspace.id);
    onWorkspaceChange?.(workspace, workspaces);
    if (switchesCountry) {
      // Changing country repoints every operational storage key. Modules already holding
      // the previous country's records in memory would otherwise flush them into the new
      // country on their next debounced save, so reload instead of swapping underneath.
      try {
        await setActiveCountryWorkspace(supabase, workspace, orgSlug);
      } catch (cause) {
        pushToast({ type: "warn", message: cause?.message || "Country selection was saved on this device only." });
      }
      window.location.reload();
      return;
    }
    if (revealPlans) {
      // Adding a country and paying for it are separate panels; point the admin at the
      // plan picker, which is already retargeted to the country selected above.
      window.requestAnimationFrame(() => {
        document.getElementById("billing-plan-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    try {
      await setActiveCountryWorkspace(supabase, workspace, orgSlug);
    } catch (cause) {
      pushToast({ type: "warn", message: cause?.message || "Country selection was saved on this device only." });
    }
  };

  const addMarket = async (marketId) => {
    setAddingMarket(marketId);
    setError(null);
    try {
      const workspace = await createCountryWorkspace(supabase, marketId, orgSlug);
      pushToast({ type: "success", message: `${workspace.display_name} added. Choose a plan to activate billing.` });
      await reload();
    } catch (cause) {
      const message = cause?.message || "Could not add country.";
      setError(message);
      pushToast({ type: "error", message });
    } finally {
      setAddingMarket(null);
    }
  };

  const changeDocumentLocale = async (event) => {
    if (!activeWorkspace) return;
    setSavingLocale(true);
    setError(null);
    try {
      const updated = await updateCountryWorkspaceDocumentLocale(supabase, activeWorkspace, event.target.value);
      const next = workspaces.map((workspace) => (workspace.id === updated.id ? updated : workspace));
      setWorkspaces(next);
      onWorkspaceChange?.(updated, next);
      pushToast({ type: "success", message: `Default document language updated for ${updated.display_name}.` });
    } catch (cause) {
      const message = cause?.message || "Could not update document language.";
      setError(message);
      pushToast({ type: "error", message });
    } finally {
      setSavingLocale(false);
    }
  };

  return (
    <section className="country-workspace-billing" aria-labelledby="country-workspace-billing-title">
      <div className="country-workspace-billing__head">
        <div>
          <span><Globe2 size={15} /> Multi-country organisation</span>
          <h2 id="country-workspace-billing-title">Countries &amp; subscriptions</h2>
          <p>Each country is billed independently in its local currency. Your login and organisation stay shared.</p>
        </div>
        <div className="country-workspace-billing__rule"><CreditCard size={16} /> One country = one subscription</div>
      </div>

      {loading ? <p className="country-workspace-billing__empty">Loading country workspaces…</p> : null}
      {error ? <div className="country-workspace-billing__error">{error}</div> : null}

      <div className="country-workspace-billing__grid">
        {workspaces.map((workspace) => {
          const definition = countryWorkspaceDefinition(workspace.market_id);
          const status = billingStatus(workspace);
          const selected = workspace.id === activeId;
          return (
            <button
              type="button"
              key={workspace.id}
              className={`country-workspace-card${selected ? " is-selected" : ""}`}
              onClick={() => void chooseWorkspace(workspace)}
              aria-pressed={selected}
            >
              <span className="country-workspace-card__flag" aria-hidden="true">{definition.flag}</span>
              <span className="country-workspace-card__body">
                <strong>{workspace.display_name}</strong>
                <small>{definition.currency} billing · documents {workspace.default_document_locale}</small>
                <span className={`country-workspace-card__status is-${status.tone}`}>{status.label}</span>
              </span>
              <span className="country-workspace-card__check">{selected ? <Check size={17} /> : null}</span>
            </button>
          );
        })}
      </div>

      {isAdmin && activeWorkspace && !workspaceHasPaidAccess(activeWorkspace) ? (
        <div className="country-workspace-billing__cta">
          <span>{activeWorkspace.display_name} has no active subscription. Each country is paid for separately.</span>
          <button type="button" onClick={() => void chooseWorkspace(activeWorkspace, { revealPlans: true })}>
            Choose a plan for {activeWorkspace.display_name}
          </button>
        </div>
      ) : null}

      {isAdmin && missingMarkets.length ? (
        <div className="country-workspace-billing__add">
          <span>Add another operational country:</span>
          <div>
            {missingMarkets.map((marketId) => {
              const definition = countryWorkspaceDefinition(marketId);
              return (
                <button
                  type="button"
                  key={marketId}
                  disabled={Boolean(addingMarket)}
                  onClick={() => void addMarket(marketId)}
                >
                  <Plus size={14} /> {definition.flag} {definition.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeWorkspace ? (
        <div className="country-workspace-billing__language">
          <div>
            <strong>Document language</strong>
            <span>Default for new RAMS, permits, surveys and site reports in {activeWorkspace.display_name}.</span>
          </div>
          <label>
            <span className="sr-only">Default document language</span>
            <select
              value={activeWorkspace.default_document_locale}
              onChange={(event) => void changeDocumentLocale(event)}
              disabled={!isAdmin || savingLocale}
            >
              <option value="en-GB">English (United Kingdom)</option>
              <option value="pl-PL">Polski (Polska)</option>
              <option value="en-AU">English (Australia)</option>
            </select>
          </label>
        </div>
      ) : null}

      <p className="country-workspace-billing__language-note">
        The app interface stays in English. Document language follows the selected country workspace and can be overridden per document.
      </p>
    </section>
  );
}
