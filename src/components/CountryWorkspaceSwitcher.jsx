import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  COUNTRY_WORKSPACE_CHANGED_EVENT,
  countryWorkspaceDefinition,
  cacheActiveCountryWorkspace,
  ensureLegacyCountryWorkspace,
  loadCountryWorkspaces,
  pickActiveCountryWorkspace,
  setActiveCountryWorkspace,
} from "../utils/countryWorkspaces";
import { getOrgMarketId } from "../utils/orgMarket";
import { persistOrgRow } from "../utils/orgMembership";
import { getOrgId } from "../utils/orgId";
import { ORG_TRIAL_ENDS_AT_KEY, removeScopedBilling, writeScopedBilling } from "../utils/billingState";

function persistWorkspaceEntitlement(workspace) {
  const billing = workspace?.billing;
  // Keep the last primary entitlement during a transient read failure. The backend
  // still checks every write. Secondary countries stay locked until billing is readable.
  if (workspace?.billing_unavailable && workspace?.is_primary) return;
  if (workspace?.is_primary && Object.hasOwn(workspace, "evaluation_trial_ends_at")) {
    // Refresh administrative extensions (and revocations) alongside country billing.
    // This runs only after the load's organisation/revision guards have passed.
    if (workspace.evaluation_trial_ends_at) writeScopedBilling(ORG_TRIAL_ENDS_AT_KEY, workspace.evaluation_trial_ends_at);
    else removeScopedBilling(ORG_TRIAL_ENDS_AT_KEY);
  }
  persistOrgRow({
    billing_plan: billing?.billing_plan || null,
    subscription_status: billing?.subscription_status || "none",
    subscription_past_due_since: billing?.past_due_since || null,
    stripe_current_period_end: billing?.current_period_end || null,
    stripe_cancel_at_period_end: Boolean(billing?.cancel_at_period_end),
    stripe_trial_end: billing?.stripe_trial_end || null,
  }, { billingScope: "workspace" });
}

export default function CountryWorkspaceSwitcher({ supabase }) {
  const { orgId, role } = useApp();
  const [workspaces, setWorkspaces] = useState([]);
  const [active, setActive] = useState(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const loadRevision = useRef(0);

  const load = useCallback(async () => {
    if (!supabase || !orgId || orgId === "default") return;
    const revision = ++loadRevision.current;
    try {
      if (role === "admin") await ensureLegacyCountryWorkspace(supabase, getOrgMarketId(orgId), orgId);
      const rows = await loadCountryWorkspaces(supabase, orgId);
      if (revision !== loadRevision.current || getOrgId() !== orgId) return;
      const selected = pickActiveCountryWorkspace(rows, orgId);
      setWorkspaces(rows);
      setActive(selected);
      if (selected) {
        cacheActiveCountryWorkspace(selected, orgId);
        persistWorkspaceEntitlement(selected);
      }
    } catch {
      if (revision !== loadRevision.current || getOrgId() !== orgId) return;
      setWorkspaces([]);
      setActive(null);
    }
  }, [orgId, role, supabase]);

  useEffect(() => {
    void load();
    const onChanged = () => void load();
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onChanged);
    window.addEventListener("mysafeops-billing-refresh", onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      loadRevision.current += 1;
      window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onChanged);
      window.removeEventListener("mysafeops-billing-refresh", onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!active || !workspaces.length) return null;
  const definition = countryWorkspaceDefinition(active.market_id);

  const selectWorkspace = async (workspace) => {
    setActive(workspace);
    setOpen(false);
    persistWorkspaceEntitlement(workspace);
    const saved = await setActiveCountryWorkspace(supabase, workspace, orgId).then(() => true).catch(() => false);
    if (saved) window.location.reload();
  };

  return (
    <div className="country-workspace-switcher" ref={rootRef}>
      <button
        type="button"
        className="country-workspace-switcher__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Switch operational country"
      >
        <Globe2 size={15} />
        <span aria-hidden="true">{definition.flag}</span>
        <strong>{active.display_name}</strong>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="country-workspace-switcher__menu" role="listbox" aria-label="Operational country">
          <span>Operational country</span>
          {workspaces.map((workspace) => {
            const item = countryWorkspaceDefinition(workspace.market_id);
            const selected = workspace.id === active.id;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                key={workspace.id}
                onClick={() => void selectWorkspace(workspace)}
              >
                <span>{item.flag}</span>
                <span><strong>{workspace.display_name}</strong><small>{item.currency} · documents {workspace.default_document_locale}</small></span>
                {selected ? <Check size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
