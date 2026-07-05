import { normalizeChecklistItems, normalizeChecklistState } from "./permitChecklistUtils";
import { permitEndIso } from "./permitRules";
import { PERMIT_TYPES, checklistStringsForType } from "./permitTypes";
import { loadOrgSettingsRaw } from "../../utils/orgSettingsStorage";
import { escapeHtml, escapeAttr, safeCssColor, safeImageSrc } from "../../utils/htmlEscape.js";
import {
  printDocBaseCss,
  renderPrintDocHeader,
  renderPrintMetaStrip,
  renderPrintDocFooter,
  buildDocReference,
} from "../../utils/pdfBranding.js";

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadOrgPrintSettings() {
  let org = {};
  try {
    org = loadOrgSettingsRaw();
  } catch {
    org = {};
  }
  const primaryColor = safeCssColor(org.primaryColor, "#0d9488");
  const accentColor = safeCssColor(org.accentColor, "#f97316");
  const theme = String(org.pdfTheme || "executive").toLowerCase() === "classic" ? "classic" : "executive";
  return {
    org,
    primaryColor,
    accentColor,
    theme,
    watermarkText: String(org.pdfWatermarkText || "").trim(),
    complianceLine:
      String(org.pdfComplianceLine || "").trim() ||
      "Controlled document. Ensure latest approved revision is in use.",
    versionPrefix: String(org.pdfVersionPrefix || "MSO").trim() || "MSO",
  };
}

function deriveVersionTag(prefix, permit) {
  const rawRev =
    permit.revision ??
    permit.rev ??
    permit.version ??
    permit.templateVersion ??
    permit.updatedAt ??
    permit.createdAt ??
    "";
  const normalizedRev = String(rawRev || "")
    .replace(/[^\w.-]/g, "")
    .slice(0, 24);
  return normalizedRev ? `${prefix}-${normalizedRev}` : `${prefix}-${String(permit.id || "UNKNOWN").slice(0, 10)}`;
}

/** Full HTML document for permit print/preview (also composed into RAMS site pack). */
export function renderPermitDocumentHtml(permit) {
  const def = PERMIT_TYPES[permit.type] || PERMIT_TYPES.general;
  const printSettings = loadOrgPrintSettings();
  const { org, primaryColor, accentColor, theme, watermarkText, complianceLine, versionPrefix } = printSettings;
  const checklistItems = normalizeChecklistItems(
    permit.type || "general",
    permit,
    checklistStringsForType(permit.type || "general")
  );
  const checklistState = normalizeChecklistState(permit.checklist, checklistItems);
  const checkedCount = checklistItems.filter((item) => checklistState[item.id]).length;
  const endIso = permitEndIso(permit);

  const checklistHTML = checklistItems
    .map(
      (item) => `
    <tr>
      <td style="padding:5px 8px;border:1px solid #ddd;width:30px;text-align:center">
        <span style="font-size:14px;color:${checklistState[item.id] ? "#27500A" : "#ccc"}">${checklistState[item.id] ? "✓" : "○"}</span>
      </td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-size:12px;color:${checklistState[item.id] ? "#000" : "#888"}">${escapeHtml(item.text)}</td>
    </tr>`
    )
    .join("");

  const extraHTML = (def.extraFields || [])
    .filter((f) => permit.extraFields?.[f.key])
    .map(
      (f) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666;width:40%">${escapeHtml(f.label)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px">${escapeHtml(permit.extraFields[f.key])}</td>
    </tr>`
    )
    .join("");

  const authHTML = [
    permit.authorisedByRole &&
      `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Authorising role / competency</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">${escapeHtml(permit.authorisedByRole)}</td></tr>`,
    permit.briefingConfirmedAt &&
      `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Briefing confirmed</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">${escapeHtml(fmtDateTime(permit.briefingConfirmedAt))}</td></tr>`,
    permit.evidenceNotes &&
      `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Evidence notes</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">${escapeHtml(permit.evidenceNotes)}</td></tr>`,
    permit.evidencePhotoUrl
      ? (() => {
          const src = safeImageSrc(permit.evidencePhotoUrl);
          const cell = src
            ? `<img src="${escapeAttr(src)}" alt="Evidence photo" style="max-height:120px;max-width:100%;object-fit:contain"/>`
            : escapeHtml(permit.evidencePhotoUrl);
          return `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Evidence photo</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">${cell}</td></tr>`;
        })()
      : permit.evidencePhotoStoragePath
        ? `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Evidence photo</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">Stored in workspace (open app for signed access)</td></tr>`
        : "",
  ]
    .filter(Boolean)
    .join("");
  const legalRefs = Array.isArray(permit.complianceProfile?.legalReferences)
    ? permit.complianceProfile.legalReferences.filter(Boolean)
    : [];
  const legalRefsHtml = legalRefs.length
    ? `<h2>Legal references (UK)</h2>
  <ul style="margin:0 0 10px 18px;padding:0;font-size:11px;line-height:1.5">
    ${legalRefs.map((ref) => `<li>${escapeHtml(ref)}</li>`).join("")}
  </ul>`
    : "";
  const signatureRows = Array.isArray(permit.signatures) && permit.signatures.length > 0
    ? permit.signatures
    : [
        { role: "issuer", signedBy: permit.issuedBy || "", signedAt: "", note: "", signatureImageDataUrl: "" },
        { role: "receiver", signedBy: permit.issuedTo || "", signedAt: "", note: "", signatureImageDataUrl: "" },
      ];
  const signatureRowsHtml = signatureRows
    .map((row) => {
      const roleLabel = escapeHtml(String(row.role || "").replace(/_/g, " ") || "signature");
      const signer = escapeHtml(row.signedBy || "—");
      const when = escapeHtml(row.signedAt ? fmtDateTime(row.signedAt) : "—");
      const note = row.note ? `<div style="font-size:10px;color:#666;margin-top:2px">${escapeHtml(row.note)}</div>` : "";
      const signatureImage = row.signatureImageDataUrl
        ? (() => {
            const src = safeImageSrc(row.signatureImageDataUrl);
            return src
              ? `<img src="${escapeAttr(src)}" alt="${roleLabel} signature" style="max-width:100%;max-height:42px;object-fit:contain;display:block;margin:0 auto"/>`
              : "";
          })()
        : "";
      return `<tr style="height:48px">
        <td style="padding:6px;border:1px solid #ddd">${roleLabel}</td>
        <td style="padding:6px;border:1px solid #ddd">${signer}${note}</td>
        <td style="padding:4px;border:1px solid #ddd">${signatureImage}</td>
        <td style="padding:6px;border:1px solid #ddd">${when}</td>
      </tr>`;
    })
    .join("");

  const versionTag = escapeHtml(deriveVersionTag(versionPrefix, permit));
  const docRef = escapeHtml(buildDocReference(org, def.label));
  const themeTypeColor = theme === "executive" ? primaryColor : def.color;
  const themeTypeBg = theme === "executive" ? `${primaryColor}1A` : def.bg;
  const statusLc = String(permit.status || "").toLowerCase();
  const watermarkFallback =
    statusLc === "active" ? "ACTIVE" : statusLc === "closed" ? "CLOSED" : "DRAFT";
  const watermarkLabel = escapeHtml(watermarkText || watermarkFallback);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>PTW — ${escapeHtml(def.label)}</title>
  <style>
    ${printDocBaseCss(org)}
    body{font-size:12px;line-height:1.45;padding:16px 16px 32px;position:relative}
    .watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:84px;font-weight:800;letter-spacing:0.14em;color:rgba(100,116,139,0.09);transform:rotate(-28deg);z-index:0;text-transform:uppercase}
    .doc-content{position:relative;z-index:1;padding-bottom:12px}
    .doc-chip{display:inline-flex;align-items:center;gap:6px;border:0.5px solid ${primaryColor};border-radius:999px;padding:2px 10px;font-size:10px;color:${primaryColor};font-weight:700;letter-spacing:0.04em;margin-right:6px}
    .ptw-type{background:${themeTypeBg};color:${themeTypeColor};padding:8px 14px;border-radius:8px;font-weight:bold;font-size:14px;max-width:min(42%,100%);text-align:right;overflow-wrap:anywhere;flex-shrink:0;border:1px solid ${themeTypeColor}22}
    .ptw-type-row{display:flex;justify-content:flex-end;margin:-4px 0 12px}
    h2{font-size:12px;background:#f8fafc;padding:6px 10px;margin:12px 0 6px;font-weight:bold;border-left:4px solid ${accentColor}}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:fixed}
    th{background:#0f172a;color:#fff;padding:5px 8px;font-size:11px;text-align:left}
    td,th{vertical-align:top;overflow-wrap:anywhere;word-break:break-word}
    p,li,span{overflow-wrap:anywhere}
    img,svg{max-width:100%;height:auto}
    .doc-top,.header,h2,.signatures{break-inside:avoid-page;page-break-inside:avoid}
    .sig-box{height:50px;border:1px solid #ddd;border-radius:4px}
    @media print{
      body{padding:0}
      .doc-content{padding-bottom:0}
      .ptw-type,.doc-chip{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      a{word-break:break-all}
    }
  </style></head><body>
  <div class="watermark">${watermarkLabel}</div>
  <div class="doc-content">
  ${renderPrintDocHeader(org, {
    docTitle: def.label,
    docSubtitle: "Permit to work · controlled site document",
    docBadge: `${theme.toUpperCase()} · VER ${versionTag}`,
    docRef: buildDocReference(org, def.label),
  })}
  ${renderPrintMetaStrip(org, {
    moduleLabel: def.label,
    recordNote: `Permit ${escapeHtml(permit.id || "—")}`,
    extra: escapeHtml(permit.location || ""),
    docRef: buildDocReference(org, def.label),
  })}
  <div class="doc-top">
    <span class="doc-chip">STATUS ${escapeHtml(String(permit.status || "draft").toUpperCase())}</span>
    <span class="doc-chip">ISSUED ${escapeHtml(fmtDateTime(permit.startDateTime))}</span>
  </div>
  <div class="ptw-type-row"><div class="ptw-type">${escapeHtml(def.label)}</div></div>
  <table class="signatures">
    <tr><td style="padding:4px 8px;border:1px solid #ddd;width:30%;font-size:11px;color:#666">Work description</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">${escapeHtml(permit.description || "—")}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Location</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(permit.location || "—")}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Issued to</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(permit.issuedTo || "—")}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Start</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(fmtDateTime(permit.startDateTime))}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Expiry</td><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold">${escapeHtml(fmtDateTime(endIso))}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Issued by</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(permit.issuedBy || "—")}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Permit No.</td><td style="padding:4px 8px;border:1px solid #ddd;font-family:monospace;font-size:11px">${escapeHtml(permit.id)}</td></tr>
    ${extraHTML}
    ${authHTML}
  </table>
  <h2>Pre-work checklist (${checkedCount}/${checklistItems.length || 0} confirmed)</h2>
  <table><tbody>${checklistHTML}</tbody></table>
  ${permit.notes ? `<h2>Conditions / restrictions</h2><p style="font-size:12px;line-height:1.6;padding:6px 8px;background:#fff8e6;border:0.5px solid #e5c060">${escapeHtml(permit.notes)}</p>` : ""}
  ${legalRefsHtml}
  <h2>Signatures</h2>
  <table>
    <tr><th>Role</th><th>Name</th><th>Signature</th><th>Date/Time</th></tr>
    ${signatureRowsHtml}
  </table>
  ${
    statusLc === "closed" && permit.closedAt
      ? `<h2>Permit closure</h2><p style="font-size:12px;line-height:1.6;padding:8px 10px;background:#f8fafc;border:0.5px solid #e2e8f0;margin:0 0 10px">Closed: ${escapeHtml(fmtDateTime(permit.closedAt))}</p>`
      : ""
  }
  ${
    permit.lessonsLearned
      ? `<h2>Lessons learned</h2><p style="font-size:12px;line-height:1.6;padding:8px 10px;background:#e8f4fc;border:0.5px solid #cfe3f8;color:#0b4f7c;margin:0 0 10px">${escapeHtml(permit.lessonsLearned)}</p>`
      : ""
  }
  ${renderPrintDocFooter(org, { extra: `${fmtDateTime(permit.createdAt)} · ${docRef}` })}
  </div>
  </body></html>`;
}
