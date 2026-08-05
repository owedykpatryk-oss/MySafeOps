import { getOrgId } from "./orgId";
import { loadCountryWorkspaces } from "./countryWorkspaces";
import { consolidateManagementStates } from "./managementOverview";

/**
 * Read every country's management document the signed-in user is entitled to and fold
 * them into one read-only roll-up.
 *
 * There is no organisation-wide document to read: the state is stored per country and
 * RLS decides which rows come back, so a country-restricted admin simply sees fewer
 * countries rather than a filtered version of someone else's plan.
 */
export async function loadManagementRollup(supabase, orgSlug = getOrgId()) {
  if (!supabase) throw new Error("Cloud sign-in is required for the consolidated view.");

  const workspaces = await loadCountryWorkspaces(supabase, orgSlug);
  if (!workspaces.length) return consolidateManagementStates([]);

  const { data, error } = await supabase
    .from("management_workspaces")
    .select("workspace_id,state,updated_at")
    .in("workspace_id", workspaces.map((workspace) => workspace.id));
  if (error) throw error;

  const stateByWorkspace = new Map((data || []).map((row) => [row.workspace_id, row]));
  const entries = workspaces
    .filter((workspace) => stateByWorkspace.has(workspace.id))
    .map((workspace) => ({
      workspaceId: workspace.id,
      countryName: workspace.display_name,
      marketId: workspace.market_id,
      state: stateByWorkspace.get(workspace.id)?.state,
    }));

  const rollup = consolidateManagementStates(entries);
  // Countries that exist but have never opened the planner are worth showing as empty
  // rather than hiding — otherwise the roll-up silently under-reports the group.
  rollup.countriesWithoutPlan = workspaces
    .filter((workspace) => !stateByWorkspace.has(workspace.id))
    .map((workspace) => ({ workspaceId: workspace.id, countryName: workspace.display_name }));
  return rollup;
}
