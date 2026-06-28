import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import { getOrgId } from "../utils/orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import {
  AUTOMATION_RULE_DEFS,
  getOrgAutomationRules,
  saveOrgAutomationRules,
} from "../utils/orgAutomationRules";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import SurveyTemplateEditor from "./SurveyTemplateEditor";
import MsTemplateEditor from "./MsTemplateEditor";

const ss = {
  ...ms,
  card: { ...ms.card, marginBottom: 16 },
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0",
    borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
  },
};

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        background: value ? "#0d9488" : "var(--color-border-secondary,#ccc)",
        position: "relative",
        transition: "background .2s",
        flexShrink: 0,
        border: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 20 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .2s",
        }}
      />
    </button>
  );
}

export default function OrgAutomationSettings() {
  const { caps } = useApp();
  const { supabase } = useSupabaseAuth();
  const canEdit = Boolean(caps?.orgSettings);
  const [rules, setRules] = useState(() => getOrgAutomationRules());
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRules(getOrgAutomationRules());
  }, []);

  const persist = async (nextRules) => {
    setBusy(true);
    const stored = saveOrgAutomationRules(nextRules, { merge: false });
    setRules(stored);
    if (supabase && canEdit) {
      try {
        const raw = loadOrgSettingsRaw();
        const cloudAt = await pushOrgBrandingToCloud(supabase, raw);
        if (cloudAt) saveOrgSettingsRaw(raw, getOrgId(), cloudAt);
      } catch {
        /* local ok */
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setBusy(false);
  };

  const setRule = (id, value) => {
    const next = { ...rules, [id]: value };
    setRules(next);
    void persist(next);
  };

  const setStaleDays = (raw) => {
    const n = Math.max(0, Math.min(365, Math.floor(Number(raw) || 0)));
    const next = { ...rules, staleSurveyReminderDays: n };
    setRules(next);
    void persist(next);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="AUTO"
        title="Automation rules"
        lead="Deterministic gates and reminders — no AI. Admins can soften or disable checks per organisation."
        right={
          saved ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#27500A" }}>Saved</span>
          ) : null
        }
      />

      {!canEdit ? (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Only organisation admins can change automation rules.
        </p>
      ) : null}

      <div style={ss.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Document gates
        </div>
        {AUTOMATION_RULE_DEFS.map((def) => (
          <div key={def.id} style={ss.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{def.label}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.45 }}>{def.hint}</div>
            </div>
            <Toggle
              value={rules[def.id] !== false}
              onChange={(v) => setRule(def.id, v)}
              disabled={!canEdit || busy}
            />
          </div>
        ))}
      </div>

      <div style={ss.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Reminders
        </div>
        <div style={{ ...ss.row, borderBottom: "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Stale survey draft reminders</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.45 }}>
              Notify when a non-final survey has not been updated for this many days. Set to 0 to disable.
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="number"
              min={0}
              max={365}
              value={rules.staleSurveyReminderDays}
              disabled={!canEdit || busy}
              onChange={(e) => setStaleDays(e.target.value)}
              style={{ width: 64, padding: "6px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)" }}
            />
            days
          </label>
        </div>
      </div>

      <SurveyTemplateEditor />

      <MsTemplateEditor />

      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, margin: 0 }}>
        <Zap size={14} style={{ verticalAlign: "middle", marginRight: 4 }} aria-hidden />
        Playbooks, next-action hints and dashboard attention rows still run when gates are off — only hard blocks and scheduled stale-survey scans respect these toggles.
      </p>
    </div>
  );
}
