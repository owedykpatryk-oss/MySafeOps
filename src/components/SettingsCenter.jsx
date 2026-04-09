import { useState, useEffect } from "react";
import { Bell, Building2, Code2, CreditCard, Shield, Users, UserPlus } from "lucide-react";

import { ms } from "../utils/moduleStyles";
import { WORKSPACE_SETTINGS_TABS } from "../config/workspaceSettingsTabs";
import CloudAccount from "./CloudAccount";
import BillingLimits from "./BillingLimits";
import InviteUsers from "./InviteUsers";
import OrgMembers from "./OrgMembers";
import OrgSettings from "./OrgSettings";
import NotificationSettings from "../offline/NotificationSettings";
import DeveloperTools from "./DeveloperTools";

const ss = ms;

const TAB_ICONS = {
  cloud: Shield,
  billing: CreditCard,
  invites: UserPlus,
  members: Users,
  organisation: Building2,
  notifications: Bell,
  developer: Code2,
};

const TABS = WORKSPACE_SETTINGS_TABS.map((t) => ({ ...t, icon: TAB_ICONS[t.id] }));

export default function SettingsCenter({ initialTab = "cloud", checkoutReturn = null }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const quickActions = [
    { label: "Invite teammate", target: "invites", helper: "Create + send invite links" },
    { label: "Manage members", target: "members", helper: "Roles and access control" },
    { label: "Check plan limits", target: "billing", helper: "Usage vs plan caps" },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Quick actions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 8 }}>
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setTab(a.target)}
              className="app-surface-card"
              style={{
                ...ss.btn,
                justifyContent: "flex-start",
                textAlign: "left",
                padding: "10px 12px",
                borderColor: "var(--color-border-tertiary,#e2e8f0)",
                minHeight: 52,
              }}
            >
              <span>
                <span style={{ display: "block", fontWeight: 600, color: "var(--color-text-primary)" }}>{a.label}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)" }}>{a.helper}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...ss.card, marginBottom: 16, padding: "0.9rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="app-pill-toggle"
                style={{
                  ...ss.btn,
                  padding: "9px 12px",
                  borderColor: active ? "#0d9488" : "var(--color-border-tertiary,#e2e8f0)",
                  background: active ? "var(--color-accent-muted,#ccfbf1)" : "#fff",
                  color: active ? "#0f766e" : "var(--color-text-primary)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={15} aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "cloud" && <CloudAccount />}
      {tab === "billing" && <BillingLimits checkoutReturn={checkoutReturn} />}
      {tab === "invites" && <InviteUsers />}
      {tab === "members" && <OrgMembers />}
      {tab === "organisation" && <OrgSettings />}
      {tab === "notifications" && (
        <div style={{ marginBottom: 24 }}>
          <NotificationSettings />
        </div>
      )}
      {tab === "developer" && <DeveloperTools />}
    </div>
  );
}
