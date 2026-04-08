import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const ss = ms;
const ROLES = ["admin", "supervisor", "operative"];

export default function OrgMembers() {
  const { caps } = useApp();
  const { supabase, user } = useSupabaseAuth();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const canManage = Boolean(caps?.orgSettings);

  const load = async () => {
    if (!supabase || !user) return;
    setStatus({ type: "", text: "" });
    setLoading(true);
    const { data, error } = await supabase.rpc("list_org_members");
    if (error) {
      setStatus({ type: "error", text: error.message || "Could not load members." });
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [supabase, user]);

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
      await load();
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Could not update role." });
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
      await load();
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Could not remove member." });
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
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>Loading members…</p>
        ) : null}
        {rows.length === 0 && status.text ? (
          <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{status.text}</p>
        ) : null}
        {rows.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => {
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
        {rows.length > 0 && status.text ? <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{status.text}</p> : null}
        {!canManage && rows.length > 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Only organisation admins can change roles or remove members.
          </p>
        ) : null}
      </div>
    </>
  );
}
