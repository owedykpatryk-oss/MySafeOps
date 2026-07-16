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
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg.js";
import {
  renderUtilityMappingHeroCover,
  renderUtilityMappingDocControlPage,
  utilityMappingCoverSystemCss,
  resolveUtilityMappingLogoSrc,
} from "../../utils/utilityMappingCovers.js";
import { utilityMappingBodyPrintCss } from "../../utils/utilityMappingPrintTheme.js";
import { buildPermitStatusDeepLink, renderDigGuidancePrintHtml } from "./permitDigGuidance";
import { renderGuidancePrintHtml } from "./permitGuidance/registry";
import { formatOrgDateTime } from "../../utils/orgLocale.js";

export { buildPermitStatusDeepLink };

const fmtDateTime = formatOrgDateTime;

function permitStatusVisual(status) {
  const s = String(status || "draft").toLowerCase();
  const map = {
    active: { bg: "#ecfdf5", fg: "#047857", border: "#6ee7b7", label: "ACTIVE" },
    approved: { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd", label: "APPROVED" },
    pending_review: { bg: "#fef3c7", fg: "#b45309", border: "#fcd34d", label: "PENDING REVIEW" },
    draft: { bg: "#fffbeb", fg: "#b45309", border: "#fcd34d", label: "DRAFT" },
    closed: { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1", label: "CLOSED" },
    expired: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5", label: "EXPIRED" },
    suspended: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5", label: "SUSPENDED" },
  };
  return map[s] || map.draft;
}

function checklistProgressHtml(checkedCount, total, primaryColor) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const pct = safeTotal ? Math.round((checkedCount / safeTotal) * 100) : 0;
  return `<div class="ptw-checklist-progress" style="margin:0 0 12px">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:6px">
      <strong>Pre-work checklist</strong>
      <span style="color:#64748b">${checkedCount}/${safeTotal} confirmed (${pct}%)</span>
    </div>
    <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, ${escapeHtml(primaryColor)}, #22c55e);border-radius:999px"></div>
    </div>
  </div>`;
}

function renderPermitCoverPage({
  permit,
  def,
  org,
  primaryColor,
  checkedCount,
  checklistTotal,
  endIso,
  qrHtml,
  versionTag,
}) {
  const st = permitStatusVisual(permit.status);
  const pct = checklistTotal ? Math.round((checkedCount / checklistTotal) * 100) : 0;
  const logoSrc = resolveUtilityMappingLogoSrc(org) || safeImageSrc(org.logo) || "";

  if (isUtilityMappingOrg()) {
    return `${renderUtilityMappingHeroCover({
      title: def.label || "Permit to work",
      subtitle: permit.description || "Permit to dig / work",
      badge: st.label,
      methodBadge: "PTW",
      kitChips: ["Permit to dig", "HSG47", "Safe dig"],
      orgName: org.name || "Utility Mapping",
      logoSrc,
      meta: [
        ["Location", permit.location || "—"],
        ["Issued to", permit.issuedTo || "—"],
        ["Valid from", fmtDateTime(permit.startDateTime)],
        ["Expires", fmtDateTime(endIso)],
        ["Permit id", permit.id || "—"],
        ["Checklist", `${checkedCount}/${checklistTotal} · ${pct}%`],
      ],
      footerNote: org.pdfFooter || "Utility Mapping · u-map.co.uk · Part of IS GROUP",
    })}${renderUtilityMappingDocControlPage({
      client: permit.client || permit.issuedTo || "",
      title: def.label || "Permit to work",
      reportRef: permit.id || "",
      logoSrc,
      authors: [
        {
          name: permit.issuedBy || permit.issuerName || "—",
          title: "Issuer",
          date: fmtDateTime(permit.startDateTime),
        },
      ],
      checkedBy: {
        name: permit.approvedBy || "—",
        title: "Authoriser",
        date: "",
      },
    })}${qrHtml || ""}`;
  }

  return `<div class="ptw-cover" style="page-break-after:always;min-height:240mm;display:flex;flex-direction:column;padding:4px 0 16px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid ${primaryColor};padding-bottom:14px;margin-bottom:18px">
      <div style="min-width:0">
        ${logoSrc ? `<img src="${escapeAttr(logoSrc)}" alt="" style="max-height:52px;margin-bottom:10px"/>` : ""}
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Permit to work</div>
        <div style="font-size:20pt;font-weight:800;color:${primaryColor};line-height:1.15;margin-top:6px">${escapeHtml(def.label)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:8px">${escapeHtml(org.name || "MySafeOps")}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.05em;background:${st.bg};color:${st.fg};border:1px solid ${st.border}">${st.label}</span>
        <div style="font-size:10px;color:#94a3b8;margin-top:10px;font-family:monospace">${escapeHtml(permit.id || "—")}</div>
        <div style="font-size:10px;color:#94a3b8">VER ${escapeHtml(versionTag)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-bottom:18px;font-size:12px">
      <div><div style="font-size:9px;text-transform:uppercase;color:#94a3b8">Location</div><strong>${escapeHtml(permit.location || "—")}</strong></div>
      <div><div style="font-size:9px;text-transform:uppercase;color:#94a3b8">Issued to</div><strong>${escapeHtml(permit.issuedTo || "—")}</strong></div>
      <div><div style="font-size:9px;text-transform:uppercase;color:#94a3b8">Valid from</div>${escapeHtml(fmtDateTime(permit.startDateTime))}</div>
      <div><div style="font-size:9px;text-transform:uppercase;color:#94a3b8">Expires</div><strong>${escapeHtml(fmtDateTime(endIso))}</strong></div>
    </div>
    <p style="font-size:12px;line-height:1.55;color:#334155;margin:0 0 16px">${escapeHtml(permit.description || "—")}</p>
    <div style="margin-bottom:18px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px">
        <strong>Checklist readiness</strong>
        <span>${checkedCount}/${checklistTotal} · ${pct}%</span>
      </div>
      <div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, ${primaryColor}, #22c55e)"></div>
      </div>
    </div>
    ${qrHtml || ""}
  </div>`;
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
export function renderPermitDocumentHtml(permit, options = {}) {
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

  const versionTagRaw = deriveVersionTag(versionPrefix, permit);
  const versionTag = escapeHtml(versionTagRaw);
  const docRef = escapeHtml(buildDocReference(org, def.label));
  const themeTypeColor = theme === "executive" ? primaryColor : def.color;
  const themeTypeBg = theme === "executive" ? `${primaryColor}1A` : def.bg;
  const statusLc = String(permit.status || "").toLowerCase();
  const watermarkFallback =
    statusLc === "active" ? "ACTIVE" : statusLc === "closed" ? "CLOSED" : "DRAFT";
  const watermarkLabel = escapeHtml(watermarkText || watermarkFallback);
  const statusUrl = buildPermitStatusDeepLink(permit.id, options.origin);
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(statusUrl)}&bgcolor=ffffff&color=0f172a&margin=6`;
  const qrHtml = permit.id
    ? `<div style="display:flex;gap:14px;align-items:center;margin:14px 0;padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;break-inside:avoid-page">
    <img src="${escapeAttr(qrImgUrl)}" alt="Live permit status QR" width="96" height="96" style="flex-shrink:0;border-radius:4px"/>
    <div style="font-size:11px;line-height:1.55">
      <strong style="font-size:12px">Scan for live status</strong><br/>
      Gate check · site office · supervisor verification<br/>
      <span style="color:#64748b;word-break:break-all">${escapeHtml(statusUrl)}</span>
    </div>
  </div>`
    : "";
  const digGuidanceHtml = renderGuidancePrintHtml(permit, { primaryColor }) || renderDigGuidancePrintHtml(permit, { primaryColor });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>PTW — ${escapeHtml(def.label)}</title>
  <style>
    ${printDocBaseCss(org)}
    ${isUtilityMappingOrg() ? `${utilityMappingCoverSystemCss()}${utilityMappingBodyPrintCss()}` : ""}
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
    table tr{break-inside:avoid-page;page-break-inside:avoid}
    .sig-box{height:50px;border:1px solid #ddd;border-radius:4px}
    .ptw-cover,.ptw-checklist-progress div[style*="linear-gradient"]{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @media print{
      body{padding:0}
      .doc-content{padding-bottom:0}
      .ptw-type,.doc-chip{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      a{word-break:break-all}
    }
  </style></head><body>
  <div class="watermark">${watermarkLabel}</div>
  <div class="doc-content">
  ${renderPermitCoverPage({
    permit,
    def,
    org,
    primaryColor,
    checkedCount,
    checklistTotal: checklistItems.length,
    endIso,
    qrHtml,
    versionTag: versionTagRaw,
  })}
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
    <span class="doc-chip" style="background:${permitStatusVisual(permit.status).bg};color:${permitStatusVisual(permit.status).fg};border-color:${permitStatusVisual(permit.status).border}">STATUS ${escapeHtml(String(permit.status || "draft").toUpperCase())}</span>
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
  ${checklistProgressHtml(checkedCount, checklistItems.length, primaryColor)}
  <table><tbody>${checklistHTML}</tbody></table>
  ${digGuidanceHtml}
  ${permit.notes ? `<h2>Conditions / restrictions</h2><p style="font-size:12px;line-height:1.6;padding:6px 8px;background:#fff8e6;border:0.5px solid #e5c060">${escapeHtml(permit.notes)}</p>` : ""}
  ${legalRefsHtml}
  <h2>Signatures</h2>
  <table>
    <tr><th>Role</th><th>Name</th><th>Signature</th><th>Date/Time</th></tr>
    ${signatureRowsHtml}
  </table>
  ${
    Array.isArray(permit.acknowledgements) && permit.acknowledgements.length > 0
      ? `<h2>Contractor acknowledgements (read &amp; sign)</h2>
  <table>
    <tr><th>Name</th><th>Note</th><th>Signature</th><th>Date/Time</th></tr>
    ${[...permit.acknowledgements]
      .slice(-20)
      .map((row) => {
        const sigSrc = row?.signatureImageDataUrl ? safeImageSrc(row.signatureImageDataUrl) : "";
        const sigImg = sigSrc
          ? `<img src="${escapeAttr(sigSrc)}" alt="Acknowledgement signature" style="max-width:100%;max-height:42px;object-fit:contain;display:block;margin:0 auto"/>`
          : "";
        return `<tr style="height:48px">
      <td style="padding:6px;border:1px solid #ddd">${escapeHtml(row?.by || "—")}</td>
      <td style="padding:6px;border:1px solid #ddd">${escapeHtml(row?.note || "—")}</td>
      <td style="padding:4px;border:1px solid #ddd">${sigImg}</td>
      <td style="padding:6px;border:1px solid #ddd">${escapeHtml(row?.at ? fmtDateTime(row.at) : "—")}</td>
    </tr>`;
      })
      .join("")}
  </table>`
      : ""
  }
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
  ${renderPrintDocFooter({ ...org, pdfComplianceLine: complianceLine }, { extra: `${fmtDateTime(permit.createdAt)} · ${docRef}` })}
  </div>
  </body></html>`;
}
