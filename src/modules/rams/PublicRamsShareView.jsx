import { openRamsPrintWindow } from "./ramsPrintHtml";
import { ms } from "../../utils/moduleStyles";
import { loadOrgScoped as load } from "../../utils/orgStorage";

const ss = { ...ms, btnP: ms.btnP };

/**
 * Read-only RAMS view opened via ?ramsShare=TOKEN (same browser / localStorage as builder).
 */
export default function PublicRamsShareView({ token }) {
  const ramsDocs = load("rams_builder_docs", []);
  const workers = load("mysafeops_workers", []);
  const projects = load("mysafeops_projects", []);

  const doc = ramsDocs.find((d) => d.shareToken && d.shareToken === token);

  if (!doc) {
    return (
      <div style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto", fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>RAMS link not available</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary,#64748b)", lineHeight: 1.5 }}>
          This read-only link only works in the same browser profile where the RAMS was saved. If you opened this on another device, use Backup / export from the main app instead.
        </p>
      </div>
    );
  }

  const rows = doc.rows || [];

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
        <button type="button" style={ss.btnP} onClick={() => openRamsPrintWindow(doc, rows, workers, projects)}>
          Print / PDF
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>You cannot edit this document here. Close this tab and open MySafeOps to make changes.</p>
    </div>
  );
}
