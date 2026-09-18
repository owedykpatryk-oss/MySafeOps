import { useMemo, useState } from "react";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import { openPrintWindowOrWarn, writePrintWindowDocument } from "../utils/htmlEscape.js";
import { wrapPrintHtmlDocument } from "../utils/pdfBranding.js";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { getOrgMarketId } from "../utils/orgMarket";
import { getMarketComplianceCopy } from "../utils/marketComplianceCopy";

function printMonthlyReport(monthLabel) {
  void (async () => {
  const org = getOrgSettings();
  const complianceCopy = getMarketComplianceCopy(getOrgMarketId());
  const workers = load("mysafeops_workers", []);
  const projects = load("mysafeops_projects", []);
  const permits = load("permits_v2", []);
  const incidents = load("mysafeops_incidents", []);
  const snags = load("snags", []);
  const rams = load("rams_builder_docs", []);
  const now = new Date();
  const expiredCerts = workers.flatMap((w) =>
    (w.certifications || []).filter((c) => c.expiryDate && new Date(c.expiryDate) < now)
  );
  const expiring = workers.flatMap((w) =>
    (w.certifications || []).filter((c) => c.expiryDate).map((c) => ({ ...c, workerName: w.name }))
  );
  const in30 = expiring.filter((c) => {
    const d = Math.ceil((new Date(c.expiryDate) - now) / 86400000);
    return d >= 0 && d <= 30;
  });

  let score = 100;
  if (expiredCerts.length) score -= Math.min(20, expiredCerts.length * 4);
  const overdueSnags = snags.filter((s) => s.dueDate && s.status === "open" && new Date(s.dueDate) < now);
  if (overdueSnags.length) score -= Math.min(15, overdueSnags.length * 3);
  const expiredPermits = permits.filter((p) => p.expiryDate && new Date(p.expiryDate) < now && p.status === "active");
  if (expiredPermits.length) score -= Math.min(20, expiredPermits.length * 5);
  score = Math.max(0, score);

  const win = openPrintWindowOrWarn();
  if (!win) return;
  const bodyHtml = `
  <div class="print-kpi-grid">
    <div class="print-kpi"><div class="print-kpi__l">Compliance score</div><div class="print-kpi__v">${score}%</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Active projects</div><div class="print-kpi__v">${projects.length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Workers</div><div class="print-kpi__v">${workers.length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">RAMS documents</div><div class="print-kpi__v">${rams.length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Permits</div><div class="print-kpi__v">${permits.length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Open snags</div><div class="print-kpi__v">${snags.filter((s) => s.status === "open").length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Incidents / near misses</div><div class="print-kpi__v">${incidents.length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Certs expiring (30 days)</div><div class="print-kpi__v">${in30.length}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Expired certificates</div><div class="print-kpi__v">${expiredCerts.length}</div></div>
  </div>
  <div class="print-section-title">Notes</div>
  <p style="font-size:12px;line-height:1.6">This report is generated locally from MySafeOps data. ${complianceCopy.statutoryReportingNote}</p>`;

  await writePrintWindowDocument(
    win,
    wrapPrintHtmlDocument(org, {
      pageTitle: `Monthly H&S summary — ${monthLabel}`,
      headerOpts: {
        docTitle: `Monthly health & safety summary`,
        docSubtitle: monthLabel,
        docBadge: "MONTHLY REPORT",
      },
      metaFields: { recordNote: `${projects.length} projects · ${workers.length} workers` },
      footerExtra: monthLabel,
      bodyHtml,
    })
  );
  win.print();
  pushAudit({ action: "monthly_report_print", entity: "report", detail: monthLabel });
  })();
}

const ss = ms;

export default function MonthlyReport() {
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const label = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [ym]);

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="MO"
        title="Monthly H&S report"
        lead="Branded print summary: compliance estimate, project/worker counts, RAMS, permits, snags, incidents, certificate horizon."
        right={
          <button type="button" style={ss.btnP} onClick={() => printMonthlyReport(label)}>
            Print / save as PDF
          </button>
        }
      />
      <div style={{ ...ss.card, maxWidth: 420 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Report period (label)</label>
        <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={{ ...ss.inp, width: "100%", marginBottom: 14 }} />
      </div>
    </div>
  );
}
