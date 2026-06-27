import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Home, HelpCircle, Settings, Search, LogOut, MoreVertical } from "lucide-react";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { getWorkspaceTitle } from "../navigation/appModules";
import { useOrgBranding } from "../hooks/useOrgBranding";

/**
 * Sticky top bar: org branding, current module title, quick actions (compact menu on mobile).
 */
export default function WorkspaceAppBar({ view, navTab, onGoDashboard, onOpenHelp, onOpenSettings, onOpenSearch }) {
  const { user, supabase } = useSupabaseAuth();
  const branding = useOrgBranding();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const cloud = isSupabaseConfigured();
  const title = getWorkspaceTitle(view, navTab);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
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

  const runMenuAction = (fn) => {
    setMenuOpen(false);
    fn?.();
  };

  const menuItems = [
    { key: "home", label: "Dashboard", icon: Home, onClick: onGoDashboard },
    { key: "help", label: "Help", icon: HelpCircle, onClick: onOpenHelp },
    { key: "settings", label: "Settings", icon: Settings, onClick: onOpenSettings },
  ];

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
      <div className="app-workspace-header__inner">
        <button
          type="button"
          onClick={onGoDashboard}
          className="app-workspace-brand"
          aria-label={`Go to dashboard — ${branding.displayName}`}
        >
          <span
            className="app-brand-mark app-workspace-brand__mark"
            style={
              branding.logo
                ? {
                    background: "#fff",
                    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                    overflow: "hidden",
                  }
                : {
                    background: branding.badgeGradient,
                    boxShadow: branding.badgeShadow,
                  }
            }
            aria-hidden
          >
            {branding.logo ? (
              <img src={branding.logo} alt="" className="app-workspace-brand__logo" />
            ) : (
              <ShieldCheck size={20} strokeWidth={2} color="#fff" />
            )}
          </span>
          <span className="app-workspace-brand__text">
            <span className="app-workspace-brand__org">{branding.displayName}</span>
            <span className="app-workspace-brand__product">
              {branding.hasCustomBranding ? "MySafeOps workspace" : "Health & safety workspace"}
            </span>
          </span>
        </button>

        <div className="app-workspace-header__title">
          <h1>{title}</h1>
          {navTab === "more" ? <span className="app-workspace-header__subtitle">Browse grouped modules below</span> : null}
        </div>

        <div className="app-workspace-header__actions">
          {user?.email && cloud ? (
            <span className="app-workspace-header__email" title={user.email}>
              {user.email}
            </span>
          ) : null}

          {onOpenSearch ? (
            <button
              type="button"
              className="app-bar-action workspace-app-bar-actions--always"
              style={btn}
              onClick={onOpenSearch}
              aria-label="Search workspace"
              title="Search (Ctrl+K)"
            >
              <Search size={16} aria-hidden />
              <span className="workspace-app-bar-btn-label">Search</span>
            </button>
          ) : null}

          <div className="workspace-app-bar-actions--desktop">
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
            {cloud && user ? (
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
            ) : null}
          </div>

          <div className="workspace-app-bar-menu" ref={menuRef}>
            <button
              type="button"
              className="app-bar-action workspace-app-bar-menu__trigger"
              style={btn}
              aria-label="More actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreVertical size={18} aria-hidden />
            </button>
            {menuOpen ? (
              <div className="workspace-app-bar-menu__panel" role="menu">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      className="workspace-app-bar-menu__item"
                      onClick={() => runMenuAction(item.onClick)}
                    >
                      <Icon size={16} aria-hidden />
                      {item.label}
                    </button>
                  );
                })}
                {cloud && user ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="workspace-app-bar-menu__item workspace-app-bar-menu__item--danger"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    <LogOut size={16} aria-hidden />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
