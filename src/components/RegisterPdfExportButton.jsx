import { useState } from "react";
import { FileDown } from "lucide-react";
import { ms } from "../utils/moduleStyles";
import { canExportModulePdf } from "../navigation/moduleCatalogMeta";
import { useRegisterPdfExportState } from "../context/RegisterPdfExportContext";

/**
 * A4 register snapshot — same engine as More grid tile export.
 */
export default function RegisterPdfExportButton({ moduleId, label, compact = false }) {
  const [busy, setBusy] = useState(false);
  const pdfCtx = useRegisterPdfExportState();
  const override =
    pdfCtx?.exportOverride?.moduleId === moduleId ? pdfCtx.exportOverride : null;
  if (!moduleId || !canExportModulePdf(moduleId)) return null;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { exportModuleRegisterPdf } = await import("../utils/moduleRegisterPdf");
      const result = await exportModuleRegisterPdf(moduleId, {
        label,
        rowsOverride: override?.rows,
        filterNote: override?.filterNote,
      });
      if (!result.ok) window.alert("Could not export this register to PDF.");
    } catch (e) {
      window.alert(e?.message || "PDF export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title={moduleId === "daily-briefing" ? "Download all briefings as detailed A4 PDF with signatures" : moduleId === "geo-photos" ? "Download geo-photos as A4 gallery PDF with GPS and bearing" : "Download register as A4 PDF (org branding)"}
      style={{
        ...ms.btn,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        padding: compact ? "6px 12px" : "8px 14px",
        minHeight: compact ? 36 : 40,
        borderColor: "#0d9488",
        color: "#0f766e",
        background: "linear-gradient(135deg, rgba(240,253,250,0.95) 0%, rgba(255,255,255,0.98) 100%)",
        boxShadow: "var(--shadow-sm)",
        opacity: busy ? 0.65 : 1,
      }}
    >
      <FileDown size={compact ? 14 : 16} strokeWidth={2.2} aria-hidden />
      {busy ? "Exporting…" : "Export PDF"}
    </button>
  );
}
