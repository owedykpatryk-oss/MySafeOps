import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Home, HelpCircle, Settings, Search, LogOut } from "lucide-react";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { getWorkspaceTitle } from "../navigation/appModules";

const teal = "#0d9488";

/**
 * Sticky top bar: current module title, org hint, quick Help/Settings/Home, optional signed-in email.
 */
export default function WorkspaceAppBar({ view, navTab, onGoDashboard, onOpenHelp, onOpenSettings, onOpenSearch }) {
  const { user, supabase } = useSupabaseAuth();
  const [signingOut, setSigningOut] = useState(false);
  const cloud = isSupabaseConfigured();
  const title = getWorkspaceTitle(view, navTab);
  const orgId = typeof localStorage !== "undefined" ? localStorage.getItem("mysafeops_orgId") || "default" : "default";

  const handleSignOut = async () => {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const btn = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: "var(--radius-sm, 10px)",
    border: "0.5px solid var(--color-border-secondary,#cbd5e1)",
    background: "#fff",
    color: "var(--color-text-primary)",
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "DM Sans, sans-serif",
    cursor: "pointer",
    textDecoration: "none",
    minHeight: 40,
    flexShrink: 0,
  };

  return (
    <header
      className="app-workspace-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "10px 1rem",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onGoDashboard}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 4,
            margin: 0,
            minHeight: 44,
            textAlign: "left",
          }}
          aria-label="Go to dashboard"
        >
          <span
            className="app-brand-mark"
            style={{
              width: 38,
              height: 38,
              background: `linear-gradient(145deg, #2dd4bf 0%, ${teal} 48%, #0f766e 100%)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-hidden
          >
            <ShieldCheck size={20} strokeWidth={2} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", lineHeight: 1.2 }}>MySafeOps</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.2 }}>
              Org · {orgId}
            </span>
          </span>
        </button>

        <div style={{ flex: 1, minWidth: 140, minHeight: 44, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a", lineHeight: 1.25 }}>{title}</h1>
          {navTab === "more" && (
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>Browse grouped modules below</span>
          )}
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}
          className="workspace-app-bar-actions"
        >
          {user?.email && (
            <span
              title={user.email}
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary)",
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: cloud ? "inline" : "none",
              }}
            >
              {user.email}
            </span>
          )}
          {onOpenSearch ? (
            <button type="button" className="app-bar-action" style={btn} onClick={onOpenSearch} aria-label="Search workspace" title="Search (Ctrl+K)">
              <Search size={16} aria-hidden />
              <span className="workspace-app-bar-btn-label">Search</span>
            </button>
          ) : null}
          <Link to="/app" className="app-bar-action" style={btn} aria-label="Go to dashboard">
            <Home size={16} aria-hidden />
            <span className="workspace-app-bar-btn-label">Dashboard</span>
          </Link>
          <button type="button" className="app-bar-action" style={btn} onClick={onOpenHelp} aria-label="Open Help">
            <HelpCircle size={16} aria-hidden />
            <span className="workspace-app-bar-btn-label">Help</span>
          </button>
          <button type="button" className="app-bar-action" style={btn} onClick={onOpenSettings} aria-label="Open Settings">
            <Settings size={16} aria-hidden />
            <span className="workspace-app-bar-btn-label">Settings</span>
          </button>
          {cloud && user && (
            <button
              type="button"
              className="app-bar-action"
              style={{ ...btn, borderColor: "#fecaca", color: "#991b1b", opacity: signingOut ? 0.7 : 1 }}
              onClick={handleSignOut}
              aria-label="Sign out"
              disabled={signingOut}
            >
              <LogOut size={16} aria-hidden />
              <span className="workspace-app-bar-btn-label">{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
