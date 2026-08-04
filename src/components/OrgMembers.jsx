import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import { refreshOrgFromSupabase, refreshMembershipRoleFromSupabase } from "../utils/orgMembership";
import { revokeOrgMemberSessions } from "../utils/revokeMemberSessions";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import InlineAlert from "./InlineAlert";
import { countryWorkspaceDefinition, loadCountryWorkspaces } from "../utils/countryWorkspaces";

const ss = ms;
const ROLES = ["admin", "supervisor", "operative"];
const NO_MEMBERSHIP_MSG = "No organisation membership";

export default function OrgMembers() {
  const { caps } = useApp();
  const { supabase, user } = useSupabaseAuth();
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("joined");
  const [countryWorkspaces, setCountryWorkspaces] = useState([]);
  const [countryAssignments, setCountryAssignments] = useState(() => new Set());

  const canManage = Boolean(caps?.orgSettings);
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (!q) return true;
      return (r.email || "").toLowerCase().includes(q) || (r.role || "").toLowerCase().includes(q);
    });
    filtered.sort((a, b) => {
      if (sortBy === "email") return (a.email || "").localeCompare(b.email || "");
      if (sortBy === "role") return (a.role || "").localeCompare(b.role || "");
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return filtered;
  }, [rows, query, roleFilter, sortBy]);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setStatus({ type: "", text: "" });
    setLoading(true);
    let { data, error } = await supabase.rpc("list_org_members");
    if (error?.message?.toLowerCase().includes("no organisation membership")) {
      try {
        await refreshOrgFromSupabase(supabase);
        const retry = await supabase.rpc("list_org_members");
        data = retry.data;
        error = retry.error;
      } catch {
        // Keep original error path below.
      }
    }
    if (error) {
      const msg = error.message || "Could not load members.";
      setStatus({
        type: "error",
        text: msg.toLowerCase().includes("no organisation membership")
          ? `${NO_MEMBERSHIP_MSG}. Please sign out and sign in again.`
          : msg,
      });
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(data || []);
    if (canManage) {
      try {
        const workspaces = await loadCountryWorkspaces(supabase);
        setCountryWorkspaces(workspaces);
        if (workspaces.length) {
          const { data: assignments, error: assignmentError } = await supabase
            .from("org_country_workspace_memberships")
            .select("workspace_id,user_id")
            .in("workspace_id", workspaces.map((workspace) => workspace.id));
          if (assignmentError) throw assignmentError;
          setCountryAssignments(new Set((assignments || []).map((item) => `${item.workspace_id}:${item.user_id}`)));
        }
      } catch {
        setCountryWorkspaces([]);
        setCountryAssignments(new Set());
      }
    }
    setLoading(false);
  }, [canManage, supabase, user]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const changeRole = async (targetId, nextRole) => {
    if (!supabase || !canManage) return;
    setBusyId(targetId);
    setStatus({ type: "", text: "" });
    try {
      const { error } = await supabase.rpc("update_org_member_role", {
        p_target: targetId,
        p_role: nextRole,
      });
      if (error) throw error;
      pushToast({ type: "success", title: "Role updated", message: `Member role changed to ${nextRole}.` });
      const revoke = await revokeOrgMemberSessions(supabase, targetId);
      if (targetId === user.id) {
        await refreshMembershipRoleFromSupabase(supabase).catch(() => {});
      }
      if (revoke.ok) {
        pushToast({
          type: "info",
          message:
            targetId === user.id
              ? "Your other sessions were signed out for security."
              : "Member was signed out on all devices — they must sign in again.",
        });
      }
      await load();
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Could not update role." });
      pushToast({ type: "error", title: "Role update failed", message: e.message || "Could not update role." });
    } finally {
      setBusyId("");
    }
  };

  const removeMember = async (targetId, emailLabel) => {
    if (!supabase || !canManage) return;
    if (!window.confirm(`Remove ${emailLabel} from this organisation?`)) return;
    setBusyId(targetId);
    setStatus({ type: "", text: "" });
    try {
      const { error } = await supabase.rpc("remove_org_member", { p_target: targetId });
      if (error) throw error;
      const revoke = await revokeOrgMemberSessions(supabase, targetId);
      pushToast({ type: "success", title: "Member removed", message: `${emailLabel} was removed from the organisation.` });
      if (revoke.ok) {
        pushToast({ type: "info", message: `${emailLabel} was signed out on all devices.` });
      }
      await load();
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Could not remove member." });
      pushToast({ type: "error", title: "Removal failed", message: e.message || "Could not remove member." });
    } finally {
      setBusyId("");
    }
  };

  const setCountryAccess = async (workspace, member, enabled) => {
    if (!supabase || !canManage) return;
    const busyKey = `${workspace.id}:${member.user_id}`;
    setBusyId(busyKey);
    try {
      const { error } = await supabase.rpc("set_org_country_workspace_member", {
        p_workspace_id: workspace.id,
        p_user_id: member.user_id,
        p_enabled: enabled,
      });
      if (error) throw error;
      setCountryAssignments((current) => {
        const next = new Set(current);
        if (enabled) next.add(busyKey);
        else next.delete(busyKey);
        return next;
      });
      pushToast({ type: "success", message: `${workspace.display_name} access ${enabled ? "enabled" : "removed"} for ${member.email}.` });
    } catch (error) {
      pushToast({ type: "error", message: error?.message || "Could not update country access." });
    } finally {
      setBusyId("");
    }
  };

  if (!supabase || !user) {
    return null;
  }

  return (
    <>
      <PageHero
        badgeText="🏢"
        title="Organisation members"
        lead="Everyone in your workspace. Admins can change roles or remove members (the last admin cannot be removed or demoted)."
      />
      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px,100%),1fr))", gap: 8, marginBottom: 10 }}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search member email…" style={ss.inp} />
          <select style={ss.inp} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select style={ss.inp} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="joined">Joined (oldest first)</option>
            <option value="email">Email (A-Z)</option>
            <option value="role">Role (A-Z)</option>
          </select>
        </div>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>Loading members…</p>
        ) : null}
        {rows.length === 0 && status.text ? <InlineAlert type={status.type || "error"} text={status.text} style={{ marginTop: 0 }} /> : null}
        {rows.length > 0 && visibleRows.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>No members match your filters.</p>}
        {visibleRows.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleRows.map((row) => {
              const isSelf = row.user_id === user.id;
              const disabled = busyId === row.user_id;
              return (
                <div
                  key={row.user_id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-all" }}>{row.email}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                      Joined {new Date(row.created_at).toLocaleString()}
                      {isSelf ? " · You" : ""}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span style={ss.chip}>{row.role}</span>
                    </div>
                    {canManage && countryWorkspaces.length ? (
                      <fieldset style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 0", padding: 0, border: 0 }}>
                        <legend style={{ marginBottom: 5, color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 700 }}>Country access</legend>
                        {countryWorkspaces.map((workspace) => {
                          const key = `${workspace.id}:${row.user_id}`;
                          const definition = countryWorkspaceDefinition(workspace.market_id);
                          const locked = workspace.is_primary || row.role === "admin";
                          return (
                            <label key={workspace.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 32, padding: "5px 8px", border: "1px solid #dbe7e3", borderRadius: 999, fontSize: 11 }}>
                              <input
                                type="checkbox"
                                checked={locked || countryAssignments.has(key)}
                                disabled={locked || busyId === key}
                                onChange={(event) => void setCountryAccess(workspace, row, event.target.checked)}
                              />
                              {definition.flag} {workspace.display_name}
                            </label>
                          );
                        })}
                      </fieldset>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {canManage ? (
                      <>
                        <label style={{ ...ss.lbl, marginBottom: 0 }}>
                          Role
                          <select
                            style={{ ...ss.inp, minWidth: 140, marginTop: 4 }}
                            value={row.role}
                            disabled={disabled}
                            onChange={(e) => changeRole(row.user_id, e.target.value)}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          style={ss.btnDanger}
                          disabled={disabled}
                          onClick={() => removeMember(row.user_id, row.email)}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span style={ss.chip}>{row.role}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {rows.length > 0 && status.text ? <InlineAlert type={status.type || "error"} text={status.text} /> : null}
        {!canManage && rows.length > 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Only organisation admins can change roles or remove members.
          </p>
        ) : null}
      </div>
    </>
  );
}
