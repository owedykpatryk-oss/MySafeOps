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

function persistWorkspaceEntitlement(workspace) {
  const billing = workspace?.billing;
  // Entitlements could not be read. Keeping the cached organisation values is safe for the
  // primary country (they are re-synced by `ensure_my_org`), but a secondary country has no
  // legacy entitlement to fall back on, so it stays locked until billing is readable again.
  if (workspace?.billing_unavailable && workspace?.is_primary) return;
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

  const load = useCallback(async () => {
    if (!supabase || !orgId || orgId === "default") return;
    try {
      if (role === "admin") await ensureLegacyCountryWorkspace(supabase, getOrgMarketId(orgId), orgId);
      const rows = await loadCountryWorkspaces(supabase, orgId);
      const selected = pickActiveCountryWorkspace(rows, orgId);
      setWorkspaces(rows);
      setActive(selected);
      if (selected) {
        cacheActiveCountryWorkspace(selected, orgId);
        persistWorkspaceEntitlement(selected);
      }
    } catch {
      setWorkspaces([]);
      setActive(null);
    }
  }, [orgId, role, supabase]);

  useEffect(() => {
    void load();
    const onChanged = () => void load();
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onChanged);
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
