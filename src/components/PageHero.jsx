import { ms } from "../utils/moduleStyles";

/**
 * Consistent page header (badge, title, lead, optional actions) used across workspace modules.
 */
export default function PageHero({ badgeText, title, lead, right, marginBottom = 24 }) {
  const len = badgeText ? String(badgeText).length : 0;
  const badgeFontSize = len > 4 ? 9 : len > 3 ? 10 : 12;

  return (
    <div
      className="app-panel-surface app-page-hero"
      style={{
        marginBottom,
        padding: "1.35rem 1.4rem",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: 16,
        borderLeft: "4px solid var(--color-accent,#0d9488)",
      }}
    >
      {badgeText ? (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-md, 12px)",
            background: "linear-gradient(145deg, #14b8a6 0%, #0d9488 45%, #0f766e 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: badgeFontSize,
            fontWeight: 700,
            letterSpacing: "0.03em",
            flexShrink: 0,
            boxShadow: "0 6px 16px rgba(13, 148, 136, 0.35)",
            lineHeight: 1.1,
            textAlign: "center",
            padding: 4,
          }}
          aria-hidden
        >
          {badgeText}
        </div>
      ) : null}
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h2 style={ms.pageTitle}>{title}</h2>
        {lead != null && lead !== "" ? (
          typeof lead === "string" ? (
            <p style={ms.pageLead}>{lead}</p>
          ) : (
            <div style={ms.pageLead}>{lead}</div>
          )
        ) : null}
      </div>
      {right ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flexShrink: 0 }}>{right}</div>
      ) : null}
    </div>
  );
}
