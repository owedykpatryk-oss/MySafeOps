import { useEffect, useState } from "react";
import { openRamsPrintWindow } from "./ramsPrintHtml";
import { ms } from "../../utils/moduleStyles";
import { loadOrgScoped as load } from "../../utils/orgStorage";
import { safeOpaqueToken } from "../../utils/htmlEscape.js";
import { supabase } from "../../lib/supabase";
import { fetchPublishedRams } from "../../utils/ramsCloudShare";

const ss = { ...ms, btnP: ms.btnP };

/**
 * Read-only RAMS view opened via ?ramsShare=TOKEN.
 */
export default function PublicRamsShareView({ token }) {
  const safeToken = safeOpaqueToken(token);
  const [published, setPublished] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!safeToken || !supabase) return;
    let active = true;
    setLoading(true);
    setPublished(null);
    setLoadError("");
    fetchPublishedRams(supabase, safeToken)
      .then((doc) => { if (active) setPublished(doc); })
      .catch(() => { if (active) setLoadError("Could not check this link. Check your connection and reload the page."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [safeToken]);

  const ramsDocs = load("rams_builder_docs", []);
  const workers = load("mysafeops_workers", []);
  const projects = load("mysafeops_projects", []);

  if (!safeToken) {
    return (
      <div style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto", fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Invalid RAMS link</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary,#64748b)", lineHeight: 1.5 }}>
          This share link is malformed. Open MySafeOps and use Backup / export instead.
        </p>
      </div>
    );
  }

  const doc = published || ramsDocs.find((d) => d.shareToken === safeToken && !d.sharePublishedAt);

  if (loading && !doc) return <div role="status" style={{ padding: "2rem 1rem", textAlign: "center" }}>Loading shared RAMS…</div>;

  if (loadError && !doc) return <div role="alert" style={{ padding: "2rem 1rem", textAlign: "center" }}>{loadError}</div>;

  if (!doc) {
    return (
      <div style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto", fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>RAMS link not available</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary,#64748b)", lineHeight: 1.5 }}>
          This link has expired, was revoked, or has not been published. Ask the sender for a new link.
        </p>
      </div>
    );
  }

  const rows = Array.isArray(doc.rows) ? doc.rows : [];

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: 720, margin: "0 auto", fontFamily: "DM Sans, system-ui, sans-serif", fontSize: 14 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>MySafeOps · RAMS (read-only)</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{doc.title || "RAMS"}</h1>
        <p style={{ color: "#64748b", margin: "8px 0 0", fontSize: 13 }}>
          {doc.location} · {doc.rows?.length || 0} hazard rows
          {doc.contentHash && (
            <span style={{ display: "block", marginTop: 6, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
              Fingerprint: {doc.contentHash}
            </span>
          )}
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={ss.btnP} onClick={() => openRamsPrintWindow(doc, rows, published ? [] : workers, published ? [] : projects)}>
          Print / PDF
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>You cannot edit this document here. Close this tab and open MySafeOps to make changes.</p>
    </div>
  );
}
