import { useState } from "react";
import { verifyTotpMfaLogin } from "../lib/mfaAal";
import { getSupportEmail } from "../config/supportContact";
import { ms } from "../utils/moduleStyles";

const ss = ms;

/**
 * Second factor step after email/password (or OAuth) when Supabase requires AAL2.
 * @param {{ client: import("@supabase/supabase-js").SupabaseClient; onSuccess: () => void | Promise<void>; supportEmail?: string; setBusy?: (v: boolean) => void }} props
 */
export default function MfaLoginChallenge({ client, onSuccess, supportEmail = getSupportEmail(), setBusy = () => {} }) {
  const [busy, setLocalBusy] = useState(false);
  const setBusyState = (v) => {
    setLocalBusy(v);
    setBusy(v);
  };
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    setBusyState(true);
    try {
      const { error } = await verifyTotpMfaLogin(client, code);
      if (error) {
        setMsg(error);
        return;
      }
      setCode("");
      await onSuccess();
    } catch (e) {
      setMsg(String(e?.message || "Verification failed."));
    } finally {
      setBusyState(false);
    }
  };

  const signOut = async () => {
    setBusyState(true);
    try {
      await client.auth.signOut();
    } finally {
      setBusyState(false);
    }
  };

  return (
    <div style={{ textAlign: "left" }}>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.55 }}>
        Enter the 6-digit code from your authenticator app to finish signing in.
      </p>
      <label style={ss.lbl} htmlFor="mfa-totp-code">
        Authenticator code
      </label>
      <input
        id="mfa-totp-code"
        type="text"
        inputMode="numeric"
        name="mfa-totp"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        style={{ ...ss.inp, maxWidth: 200, marginBottom: 10 }}
        aria-invalid={msg ? "true" : undefined}
      />
      {msg ? <p style={{ fontSize: 12, color: "#b91c1c", margin: "0 0 8px" }}>{msg}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 4 }}>
        <button type="button" style={{ ...ss.btnP, width: "100%" }} disabled={busy} onClick={() => void submit()}>
          Verify and continue
        </button>
        <button type="button" style={{ ...ss.btn, width: "100%" }} disabled={busy} onClick={() => void signOut()}>
          Use a different account
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "12px 0 0" }}>
        Lost your device? Contact {supportEmail} for account recovery.
      </p>
    </div>
  );
}
