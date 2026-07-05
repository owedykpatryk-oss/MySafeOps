import { useEffect, useMemo, useState } from "react";
import { Bell, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import { getOrgId } from "../utils/orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import {
  AUTOMATION_PRESETS,
  AUTOMATION_RULE_DEFS,
  DEFAULT_ORG_AUTOMATION_RULES,
  REMINDER_RULE_DEFS,
  applyAutomationPreset,
  getAutomationImpactLabel,
  getOrgAutomationRules,
  saveOrgAutomationRules,
  summarizeAutomationRules,
} from "../utils/orgAutomationRules";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import SurveyTemplateEditor from "./SurveyTemplateEditor";
import MsTemplateEditor from "./MsTemplateEditor";

const ss = {
  ...ms,
  card: { ...ms.card, marginBottom: 16 },
};

const IMPACT_STYLES = {
  block: { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B" },
  notify: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E40AF" },
  create: { bg: "#F0FDF4", border: "#BBF7D0", color: "#166534" },
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

function RuleRow({ def, value, onChange, disabled }) {
  const impact = IMPACT_STYLES[def.impact] || IMPACT_STYLES.notify;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
        background: value ? "var(--color-surface,#fff)" : "var(--color-background-secondary,#fafafa)",
        opacity: value ? 1 : 0.82,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{def.label}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.03em",
              padding: "2px 6px",
              borderRadius: 4,
              background: impact.bg,
              border: `1px solid ${impact.border}`,
              color: impact.color,
            }}
          >
            {getAutomationImpactLabel(def.impact)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.45 }}>{def.hint}</div>
      </div>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function OrgAutomationSettings({ onOpenNotifications }) {
  const { caps } = useApp();
  const { supabase } = useSupabaseAuth();
  const canEdit = Boolean(caps?.orgSettings);
  const [rules, setRules] = useState(() => getOrgAutomationRules());
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRules(getOrgAutomationRules());
  }, []);

  const summary = useMemo(() => summarizeAutomationRules(rules), [rules]);

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

  const applyPreset = (presetId) => {
    if (!canEdit || busy) return;
    const next = applyAutomationPreset(presetId);
    setRules(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetDefaults = () => {
    if (!canEdit || busy) return;
    void persist({ ...DEFAULT_ORG_AUTOMATION_RULES });
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="AUTO"
        title="Automation rules"
        lead="Deterministic gates and reminders — no AI. Admins control what blocks saves, what auto-creates drafts, and which scheduled nudges run for the whole organisation."
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

      <div style={{ ...ss.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))", gap: 10 }}>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#F0FDFA", border: "1px solid #99F6E4" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0F766E" }}>{summary.gatesOn}/{summary.gatesTotal}</div>
          <div style={{ fontSize: 11, color: "#115E59", marginTop: 2 }}>Document gates on</div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1D4ED8" }}>{summary.remindersOn}/{summary.remindersTotal}</div>
          <div style={{ fontSize: 11, color: "#1E3A8A", marginTop: 2 }}>Reminders on</div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#B45309" }}>
            {summary.staleSurveyActive ? `${summary.staleSurveyDays}d` : "Off"}
          </div>
          <div style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>Stale survey window</div>
        </div>
      </div>

      <div style={ss.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} aria-hidden style={{ color: "#0d9488" }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Quick presets
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: 8 }}>
          {Object.entries(AUTOMATION_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => applyPreset(id)}
              style={{
                ...ss.btn,
                textAlign: "left",
                padding: "10px 12px",
                minHeight: 64,
                flexDirection: "column",
                alignItems: "flex-start",
                opacity: !canEdit || busy ? 0.6 : 1,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>{preset.label}</span>
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.4 }}>{preset.hint}</span>
            </button>
          ))}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={resetDefaults}
            disabled={busy}
            style={{ ...ss.btn, marginTop: 10, fontSize: 12, opacity: busy ? 0.6 : 1 }}
          >
            Reset to factory defaults
          </button>
        ) : null}
      </div>

      <div style={ss.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <ShieldAlert size={16} aria-hidden style={{ color: "#DC2626" }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Document gates
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
              Hard blocks — users see an error and cannot proceed until fixed.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {AUTOMATION_RULE_DEFS.map((def) => (
            <RuleRow
              key={def.id}
              def={def}
              value={rules[def.id] !== false}
              onChange={(v) => setRule(def.id, v)}
              disabled={!canEdit || busy}
            />
          ))}
        </div>
      </div>

      <div style={ss.card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={16} aria-hidden style={{ color: "#2563EB" }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Scheduled reminders
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2, lineHeight: 1.45 }}>
                Org-wide switches — delivery still needs browser notification permission and per-type toggles.
              </div>
            </div>
          </div>
          {onOpenNotifications ? (
            <button type="button" onClick={onOpenNotifications} style={{ ...ss.btn, fontSize: 12, flexShrink: 0 }}>
              Notifications →
            </button>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {REMINDER_RULE_DEFS.map((def) => (
            <RuleRow
              key={def.id}
              def={def}
              value={rules[def.id] !== false}
              onChange={(v) => setRule(def.id, v)}
              disabled={!canEdit || busy}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid var(--color-border-tertiary,#e5e5e5)",
            background: rules.staleSurveyReminderDays > 0 ? "#FFFBEB" : "var(--color-background-secondary,#fafafa)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Stale survey draft reminders</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.45 }}>
              Notify when a non-final survey has not been updated for this many days. Set to 0 to disable.
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexShrink: 0 }}>
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

      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0 }}>
        <Zap size={14} style={{ verticalAlign: "middle", marginRight: 4 }} aria-hidden />
        Playbooks, next-action hints and dashboard attention rows still run when gates are off — only hard blocks and scheduled scans respect these toggles. Reminders need both the rule here and the matching type enabled under Notifications.
      </p>
    </div>
  );
}
