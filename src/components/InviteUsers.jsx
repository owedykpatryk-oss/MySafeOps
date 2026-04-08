import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const ss = ms;

function makeToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function InviteUsers() {
  const { orgId, caps } = useApp();
  const { supabase, user } = useSupabaseAuth();
  const [orgRow, setOrgRow] = useState(null);
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operative");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [lastInviteEmail, setLastInviteEmail] = useState("");

  const canManage = Boolean(caps?.orgSettings);

  const load = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data: org, error: orgErr } = await supabase.from("organizations").select("id,slug,name").eq("slug", orgId).maybeSingle();
    if (orgErr || !org) {
      setStatus({ type: "error", text: "Organisation lookup failed. Sign in again and retry." });
      setLoading(false);
      return;
    }
    setOrgRow(org);
    const { data, error } = await supabase
      .from("org_invites")
      .select("id,email,role,status,expires_at,created_at,invite_token")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });
    if (error) {
      setStatus({ type: "error", text: error.message || "Could not load invites." });
      setLoading(false);
      return;
    }
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [supabase, user, orgId]);

  const pendingCount = useMemo(() => items.filter((x) => x.status === "pending").length, [items]);

  const invite = async () => {
    if (!supabase || !orgRow || !canManage) return;
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setStatus({ type: "error", text: "Enter a valid email." });
      return;
    }
    setBusy(true);
    setStatus({ type: "", text: "" });
    setLastInviteLink("");
    try {
      const token = makeToken();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: inserted, error } = await supabase
        .from("org_invites")
        .insert({
          org_id: orgRow.id,
          email: clean,
          role,
          invite_token: token,
          invited_by: user.id,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/accept-invite?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(clean)}`;
      setLastInviteLink(url);
      setLastInviteEmail(clean);
      setEmail("");
      setStatus({ type: "success", text: "Invite created. Share the link below or send it by email." });
      if (inserted?.id) {
        const { error: fnErr } = await supabase.functions.invoke("send-org-invite", {
          body: { inviteId: inserted.id },
        });
        if (fnErr) {
          setStatus({
            type: "warn",
            text: `Invite created. Automatic email was not sent (${fnErr.message || "function unavailable"}); share the link manually.`,
          });
        }
      }
      await load();
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Could not create invite." });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    if (!supabase || !canManage) return;
    setBusy(true);
    setStatus({ type: "", text: "" });
    try {
      const { error } = await supabase.from("org_invites").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Could not revoke invite." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        badgeText="👥"
        title="Invite users"
        lead="Invite teammates into your organisation. Accepted invites join the same org automatically."
      />
      <div style={{ ...ss.card, marginBottom: 16 }}>
        {!canManage ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>
            Only organisation admins can invite users.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary)" }}>
              Pending invites: <strong>{pendingCount}</strong>
            </p>
            <label style={ss.lbl}>Email</label>
            <input type="email" style={ss.inp} value={email} onChange={(e) => setEmail(e.target.value)} />
            <label style={{ ...ss.lbl, marginTop: 10 }}>Role</label>
            <select style={ss.inp} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="operative">Operative</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <div style={{ marginTop: 12 }}>
              <button type="button" style={ss.btnP} disabled={busy || !email.trim()} onClick={invite}>
                Create invite
              </button>
            </div>
            {lastInviteLink && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 12 }}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Invite link</div>
                <div style={{ wordBreak: "break-all", color: "#0d9488" }}>{lastInviteLink}</div>
                <div style={{ marginTop: 8 }}>
                  <a
                    href={`mailto:${encodeURIComponent(lastInviteEmail)}?subject=${encodeURIComponent("Invitation to MySafeOps")}&body=${encodeURIComponent(`You have been invited to MySafeOps.\n\nAccept your invite:\n${lastInviteLink}\n\nSupport: mysafeops@gmail.com`)}`}
                    style={{ color: "#0d9488", fontWeight: 600, textDecoration: "none" }}
                  >
                    Open email draft
                  </a>
                </div>
              </div>
            )}
          </>
        )}
        {status.text && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 13,
              lineHeight: 1.5,
              color:
                status.type === "error"
                  ? "#b91c1c"
                  : status.type === "warn"
                    ? "#92400e"
                    : status.type === "success"
                      ? "#0f766e"
                      : "var(--color-text-secondary)",
            }}
          >
            {status.text}
          </p>
        )}
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Recent invites</div>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>Loading invites…</p>
        ) : items.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>No invites yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((row) => (
              <div key={row.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.email}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                  Expires: {new Date(row.expires_at).toLocaleString()}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <span style={ss.chip}>{row.role}</span>
                  <span
                    style={{
                      ...ss.chip,
                      color: row.status === "pending" ? "#0f766e" : row.status === "revoked" ? "#a32d2d" : "#334155",
                      background: row.status === "pending" ? "#ccfbf1" : row.status === "revoked" ? "#fee2e2" : "#e2e8f0",
                      borderColor: row.status === "pending" ? "#99f6e4" : row.status === "revoked" ? "#fecaca" : "#cbd5e1",
                    }}
                  >
                    {row.status}
                  </span>
                </div>
                {canManage && row.status === "pending" && (
                  <div style={{ marginTop: 8 }}>
                    <button type="button" style={ss.btn} disabled={busy} onClick={() => revoke(row.id)}>
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

