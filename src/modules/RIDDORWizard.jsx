import { useState, useEffect } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import { escapeHtml, openPrintWindowOrWarn, writePrintWindowDocument } from "../utils/htmlEscape.js";
import { wrapPrintHtmlDocument } from "../utils/pdfBranding.js";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import {
  defaultIncidentTypeKey,
  getIncidentTypeDef,
  getNotifiableIncidentsContent,
} from "../config/notifiableIncidentsContent";
import { getOrgMarketId } from "../utils/orgMarket";
import { formatOrgDate } from "../utils/orgLocale";

import { localDateISO, todayLocalISO } from "../utils/localDate";
const genId = () => `riddor_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = todayLocalISO;
const fmtDate = formatOrgDate;
const addDays = (iso, days) => { const d=new Date(iso); d.setDate(d.getDate()+days); return localDateISO(d); };

const ss = {
  ...ms,
  btnR: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #A32D2D", background:"#FCEBEB", color:"#791F1F", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  ta: { ...ms.inp, resize:"vertical", lineHeight:1.5 },
};

export function printNotifiableWorksheet(form, content) {
  void (async () => {
  const org = getOrgSettings();
  const def = getIncidentTypeDef(content, form.riddorType);
  const win = openPrintWindowOrWarn();
  if (!win) return;
  const he = escapeHtml;
  const row = (a, b) => `<tr><td style="border:1px solid #e2e8f0;padding:8px;width:32%;font-weight:600;background:#f8fafc">${he(a)}</td><td style="border:1px solid #e2e8f0;padding:8px">${he(b ?? "—")}</td></tr>`;
  const bodyHtml = `
  <p class="noPrint" style="background:#FAEEDA;padding:10px;border-radius:8px;border:1px solid #FAC775">${escapeHtml(content.printBanner)} — <a href="${escapeHtml(content.regulatorUrl)}">${escapeHtml(content.regulatorName)}</a></p>
  <div class="print-section-title">Incident / dangerous occurrence — draft record</div>
  <table style="width:100%;border-collapse:collapse;margin-top:10px">
    ${row("Form type", def.form || "F2508")}
    ${row("Incident type", def.label || form.riddorType)}
    ${row("Incident date", form.incidentDate)}
    ${row("Incident time", form.incidentTime)}
    ${row("Location", form.location)}
    ${row("Site address", form.siteAddress)}
    ${row("Injured person", form.injuredName)}
    ${row("Date of birth", form.injuredDob)}
    ${row("Gender", form.injuredGender)}
    ${row("Job title", form.injuredJobTitle)}
    ${row("Employer (legal)", form.employerName)}
    ${row("Employer address", form.employerAddress)}
    ${row("Work being done", form.workBeingDone)}
    ${row("Description", form.incidentDescription)}
    ${row("Cause", form.causeOfIncident)}
    ${row("Specified injury type", form.specifiedInjuryType)}
    ${row("Dangerous occurrence type", form.dangerousOccurrenceType)}
    ${row("Treatment", form.treatmentReceived)}
    ${row("Hospital", form.hospitalName)}
    ${row("Days absent", form.daysAbsent)}
    ${row("Witnesses", form.witnesses)}
    ${row("Immediate actions", form.immediateActions)}
    ${row("Reported to HSE", form.reportedToHSE ? "Yes" : "No")}
    ${row("HSE reference", form.hseReportRef)}
  </table>`;

  await writePrintWindowDocument(
    win,
    wrapPrintHtmlDocument(org, {
      pageTitle: content.printTitle,
      extraCss: `.noPrint{} @media print{.noPrint{display:none}}`,
      headerOpts: {
        docTitle: content.title,
        docSubtitle: `${def.form || "Worksheet"} · ${content.regulatorName}`,
        docBadge: content.badgeText,
      },
      metaFields: { recordNote: def.label || form.riddorType || "Draft worksheet" },
      bodyHtml,
    })
  );
  win.print();
  })();
}

/** @deprecated use printNotifiableWorksheet */
export const printRiddorF2508 = (form) => printNotifiableWorksheet(form, getNotifiableIncidentsContent("uk"));

function DeadlineAlert({ reportDate, deadlineDays, content }) {
  if (!reportDate || !deadlineDays) return null;
  const deadline = addDays(reportDate, deadlineDays);
  const daysLeft = Math.ceil((new Date(deadline)-new Date())/(1000*60*60*24));
  const overdue = daysLeft < 0;
  const urgent = daysLeft <= 2;

  return (
    <div style={{ padding:"10px 14px", borderRadius:8, fontSize:13, lineHeight:1.5, marginBottom:14,
      background:overdue?"#FCEBEB":urgent?"#FAEEDA":"#E6F1FB",
      border:`0.5px solid ${overdue?"#F09595":urgent?"#FAC775":"#B5D4F4"}`,
      color:overdue?"#791F1F":urgent?"#633806":"#0C447C",
    }}>
      <div style={{ fontWeight:500, marginBottom:2 }}>
        {overdue ? `${content.deadlinePrefix} deadline MISSED — was ${fmtDate(deadline)}` : `${content.deadlinePrefix} deadline: ${fmtDate(deadline)}`}
      </div>
      <div style={{ fontSize:12 }}>
        {overdue ? `Report is ${Math.abs(daysLeft)} days overdue. Notify ${content.regulatorName} immediately.` : `${daysLeft} day${daysLeft!==1?"s":""} remaining — confirm notification requirements.`}
      </div>
      <a href={content.regulatorUrl} target="_blank" rel="noopener noreferrer"
        style={{ fontSize:12, color:"inherit", display:"inline-block", marginTop:6, textDecoration:"underline" }}>
        {content.regulatorLinkText}
      </a>
    </div>
  );
}

function RIDDORForm({ report, onSave, onClose, content, marketId }) {
  const org = getOrgSettings();
  const projects = load("mysafeops_projects",[]);
  const defaultType = defaultIncidentTypeKey(marketId);

  const blank = {
    id:genId(), riddorType: defaultType, projectId:"",
    incidentDate:today(), incidentTime:"",
    location:"", siteAddress:"",
    injuredName:"", injuredDob:"", injuredGender:"", injuredJobTitle:"",
    employerName: org.name||"", employerAddress: org.address||"",
    incidentDescription:"", workBeingDone:"", causeOfIncident:"",
    specifiedInjuryType:"", dangerousOccurrenceType:"",
    treatmentReceived:"", hospitalName:"", treatmentDate:"",
    daysAbsent:"", returnToWorkDate:"",
    witnesses:"", immediateActions:"",
    reportedToHSE:false, hseReportRef:"", hseReportDate:"",
    status:"draft", createdAt:new Date().toISOString(),
  };

  const [form, setForm] = useState(report?{...report}:blank);
  const [step, setStep] = useState(0);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const def = getIncidentTypeDef(content, form.riddorType);
  const isSeriousInjuryType = form.riddorType === "specified" || form.riddorType === "serious_injury";
  const isDangerousType = form.riddorType === "dangerous_occurrence" || form.riddorType === "dangerous_incident";

  const STEPS = ["Incident type","Incident details","Injured person","Employer","Injury & treatment","Actions & reporting","Review"];

  return (
    <div style={{ minHeight:700, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem", overflowY:"auto" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:600 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:500, fontSize:16 }}>{content.wizardTitle}</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{content.wizardSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {def.urgent && form.incidentDate && (
          <DeadlineAlert reportDate={form.incidentDate} deadlineDays={def.deadline} content={content} />
        )}

        {/* step progress */}
        <div style={{ display:"flex", gap:3, marginBottom:20 }}>
          {STEPS.map((s,i)=>(
            <div key={i} style={{ flex:1, textAlign:"center" }}>
              <div style={{ height:3, borderRadius:2, background:i<step?"#0d9488":i===step?"#f97316":"var(--color-border-tertiary,#e5e5e5)", marginBottom:4, transition:"background .2s" }} />
              <span style={{ fontSize:9, color:i===step?"#f97316":i<step?"#0d9488":"var(--color-text-secondary)", fontWeight:i===step?500:400 }}>{s}</span>
            </div>
          ))}
        </div>

        {/* step 0 — incident type */}
        {step===0 && (
          <div>
            <label style={ss.lbl}>Reportable event type *</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
              {Object.entries(content.types).map(([k,v])=>(
                <label key={k} style={{ display:"flex", gap:12, padding:"10px 12px", borderRadius:8, cursor:"pointer",
                  background:form.riddorType===k?"#E1F5EE":"var(--color-background-secondary,#f7f7f5)",
                  border:`0.5px solid ${form.riddorType===k?"#0d9488":"var(--color-border-secondary,#ccc)"}` }}>
                  <input type="radio" checked={form.riddorType===k} onChange={()=>set("riddorType",k)} style={{ accentColor:"#0d9488", marginTop:3, flexShrink:0 }} />
                  <div>
                    <div style={{ fontWeight:500, fontSize:13 }}>{v.label}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{v.description}</div>
                    <div style={{ fontSize:11, marginTop:3 }}>
                      <span style={{ padding:"1px 8px", borderRadius:20, background:v.urgent?"#FCEBEB":"#FAEEDA", color:v.urgent?"#791F1F":"#633806" }}>
                        Report within {v.deadline||"—"} days on {v.form}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* step 1 — incident details */}
        {step===1 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div>
              <label style={ss.lbl} htmlFor="riddor-incident-date">Date of incident *</label>
              <input type="date" value={form.incidentDate} onChange={e=>set("incidentDate",e.target.value)} style={ss.inp}  id="riddor-incident-date" />
            </div>
            <div>
              <label style={ss.lbl} htmlFor="riddor-incident-time">Time of incident</label>
              <input type="time" value={form.incidentTime||""} onChange={e=>set("incidentTime",e.target.value)} style={ss.inp}  id="riddor-incident-time" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-location">Exact location where incident occurred *</label>
              <input value={form.location||""} onChange={e=>set("location",e.target.value)} placeholder="e.g. Boiler room, Level 2, 2SFG Scunthorpe" style={ss.inp}  id="riddor-location" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-site-address">Site address</label>
              <textarea value={form.siteAddress||""} onChange={e=>set("siteAddress",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:44 }}  id="riddor-site-address" />
            </div>
            <div>
              <label style={ss.lbl} htmlFor="riddor-project-id">Project</label>
              <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp} id="riddor-project-id">
                <option value="">— Select —</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {isSeriousInjuryType && (
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl} htmlFor="riddor-specified-injury-type">Type of serious / specified injury</label>
                <select value={form.specifiedInjuryType||""} onChange={e=>set("specifiedInjuryType",e.target.value)} style={ss.inp} id="riddor-specified-injury-type">
                  <option value="">— Select —</option>
                  {content.specifiedInjuries.map((i,idx)=><option key={idx} value={i}>{i}</option>)}
                </select>
              </div>
            )}
            {isDangerousType && (
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl} htmlFor="riddor-dangerous-occurrence-type">Type of dangerous incident / occurrence</label>
                <select value={form.dangerousOccurrenceType||""} onChange={e=>set("dangerousOccurrenceType",e.target.value)} style={ss.inp} id="riddor-dangerous-occurrence-type">
                  <option value="">— Select —</option>
                  {content.dangerousOccurrences.map((i,idx)=><option key={idx} value={i}>{i}</option>)}
                </select>
              </div>
            )}
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-work-being-done">What work was being done at time of incident? *</label>
              <textarea value={form.workBeingDone||""} onChange={e=>set("workBeingDone",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:50 }} placeholder="Describe the activity taking place at the time of the incident…"  id="riddor-work-being-done" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-incident-description">Description of what happened *</label>
              <textarea value={form.incidentDescription||""} onChange={e=>set("incidentDescription",e.target.value)} rows={3} style={{ ...ss.ta, minHeight:70 }} placeholder="Provide a full description of how the incident occurred…"  id="riddor-incident-description" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-cause-of-incident">Cause / contributing factors</label>
              <textarea value={form.causeOfIncident||""} onChange={e=>set("causeOfIncident",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:50 }} placeholder="What were the direct and underlying causes?"  id="riddor-cause-of-incident" />
            </div>
          </div>
        )}

        {/* step 2 — injured person */}
        {step===2 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-injured-name">Full name of injured person</label>
              <input value={form.injuredName||""} onChange={e=>set("injuredName",e.target.value)} style={ss.inp}  id="riddor-injured-name" />
            </div>
            <div>
              <label style={ss.lbl} htmlFor="riddor-injured-dob">Date of birth</label>
              <input type="date" value={form.injuredDob||""} onChange={e=>set("injuredDob",e.target.value)} style={ss.inp}  id="riddor-injured-dob" />
            </div>
            <div>
              <label style={ss.lbl} htmlFor="riddor-injured-gender">Gender</label>
              <select value={form.injuredGender||""} onChange={e=>set("injuredGender",e.target.value)} style={ss.inp} id="riddor-injured-gender">
                <option value="">— Select —</option>
                <option>Male</option><option>Female</option><option>Prefer not to say</option>
              </select>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-injured-job-title">Job title / trade</label>
              <input value={form.injuredJobTitle||""} onChange={e=>set("injuredJobTitle",e.target.value)} placeholder="e.g. Pipefitter, Electrician, Site manager" style={ss.inp}  id="riddor-injured-job-title" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-witnesses">Witnesses</label>
              <textarea value={form.witnesses||""} onChange={e=>set("witnesses",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:44 }} placeholder="Names of any witnesses to the incident…"  id="riddor-witnesses" />
            </div>
          </div>
        )}

        {/* step 3 — employer */}
        {step===3 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-employer-name">Employer / organisation name</label>
              <input value={form.employerName||""} onChange={e=>set("employerName",e.target.value)} style={ss.inp}  id="riddor-employer-name" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-employer-address">Employer address</label>
              <textarea value={form.employerAddress||""} onChange={e=>set("employerAddress",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:44 }}  id="riddor-employer-address" />
            </div>
          </div>
        )}

        {/* step 4 — injury & treatment */}
        {step===4 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl} htmlFor="riddor-treatment-received">Treatment received</label>
              <select value={form.treatmentReceived||""} onChange={e=>set("treatmentReceived",e.target.value)} style={ss.inp} id="riddor-treatment-received">
                <option value="">— Select —</option>
                <option>First aid on site only</option>
                <option>Taken to hospital — A&E</option>
                <option>Admitted to hospital</option>
                <option>Treated by GP / clinic</option>
                <option>No treatment required</option>
              </select>
            </div>
            {(form.treatmentReceived==="Taken to hospital — A&E"||form.treatmentReceived==="Admitted to hospital") && (
              <>
                <div>
                  <label style={ss.lbl} htmlFor="riddor-hospital-name">Hospital name</label>
                  <input value={form.hospitalName||""} onChange={e=>set("hospitalName",e.target.value)} style={ss.inp}  id="riddor-hospital-name" />
                </div>
                <div>
                  <label style={ss.lbl} htmlFor="riddor-treatment-date">Date of treatment</label>
                  <input type="date" value={form.treatmentDate||""} onChange={e=>set("treatmentDate",e.target.value)} style={ss.inp}  id="riddor-treatment-date" />
                </div>
              </>
            )}
            {form.riddorType==="over7day" && (
              <>
                <div>
                  <label style={ss.lbl} htmlFor="riddor-days-absent">Number of days absent</label>
                  <input type="number" value={form.daysAbsent||""} onChange={e=>set("daysAbsent",e.target.value)} style={ss.inp}  id="riddor-days-absent" />
                </div>
                <div>
                  <label style={ss.lbl} htmlFor="riddor-return-to-work-date">Actual / expected return to work</label>
                  <input type="date" value={form.returnToWorkDate||""} onChange={e=>set("returnToWorkDate",e.target.value)} style={ss.inp}  id="riddor-return-to-work-date" />
                </div>
              </>
            )}
          </div>
        )}

        {/* step 5 — actions & reporting */}
        {step===5 && (
          <div>
            <div style={{ marginBottom:12 }}>
              <label style={ss.lbl} htmlFor="riddor-immediate-actions">Immediate actions taken</label>
              <textarea value={form.immediateActions||""} onChange={e=>set("immediateActions",e.target.value)} rows={3} style={{ ...ss.ta, minHeight:60 }} placeholder="Describe immediate actions taken: first aid given, area made safe, equipment isolated, emergency services called…"  id="riddor-immediate-actions" />
            </div>
            <div style={{ padding:"10px 14px", background:"#E6F1FB", borderRadius:8, fontSize:12, color:"#0C447C", marginBottom:14 }}>
              Official guidance: <a href={content.regulatorUrl} target="_blank" rel="noopener noreferrer" style={{ color:"#185FA5" }}>{content.regulatorUrl.replace(/^https:\/\//, "")}</a>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"flex", gap:10, alignItems:"center", cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={form.reportedToHSE||false} onChange={e=>set("reportedToHSE",e.target.checked)}
                  style={{ accentColor:"#0d9488", width:15, height:15 }} />
                {content.reportedLabel}
              </label>
            </div>
            {form.reportedToHSE && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
                <div>
                  <label style={ss.lbl} htmlFor="riddor-hse-report-ref">Regulator reference number</label>
                  <input value={form.hseReportRef||""} onChange={e=>set("hseReportRef",e.target.value)} placeholder="Reference from regulator confirmation" style={ss.inp}  id="riddor-hse-report-ref" />
                </div>
                <div>
                  <label style={ss.lbl} htmlFor="riddor-hse-report-date">Date reported</label>
                  <input type="date" value={form.hseReportDate||""} onChange={e=>set("hseReportDate",e.target.value)} style={ss.inp}  id="riddor-hse-report-date" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* step 6 — review */}
        {step===6 && (
          <div>
            <div style={{ ...ss.card, border:"0.5px solid #9FE1CB", marginBottom:14 }}>
              <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>{content.title} — summary</div>
              {[
                ["Type", def?.label],
                ["Date", fmtDate(form.incidentDate)],
                ["Location", form.location||"—"],
                ["Injured person", form.injuredName||"—"],
                ["Employer", form.employerName||"—"],
                ["Form", def?.form],
                ["Deadline", form.incidentDate&&def?.deadline ? `${fmtDate(addDays(form.incidentDate, def.deadline))}` : "—"],
                [content.reportedLabel, form.reportedToHSE ? `Yes — Ref: ${form.hseReportRef||"—"}` : "Not yet reported"],
              ].map(([l,v])=>(
                <div key={l} style={{ display:"flex", gap:10, padding:"5px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13 }}>
                  <span style={{ color:"var(--color-text-secondary)", minWidth:130 }}>{l}</span>
                  <span style={{ fontWeight:500 }}>{v||"—"}</span>
                </div>
              ))}
            </div>
            {!form.reportedToHSE && (
              <div style={{ padding:"10px 14px", background:"#FCEBEB", borderRadius:8, fontSize:12, color:"#791F1F", marginBottom:14 }}>
                {content.notReportedBanner}
              </div>
            )}
            <div style={{ marginTop:12 }}>
              <button type="button" onClick={()=>printNotifiableWorksheet(form, content)} style={{ ...ss.btn, fontSize:12 }}>Print worksheet</button>
            </div>
          </div>
        )}

        {/* nav */}
        <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:20, paddingTop:16, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)", flexWrap:"wrap" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {step>0 && <button onClick={()=>setStep(s=>s-1)} style={ss.btn}>← Back</button>}
            {step<STEPS.length-1
              ? <button onClick={()=>setStep(s=>s+1)} style={ss.btnP}>Next →</button>
              : <button onClick={()=>onSave({...form,status:form.reportedToHSE?"reported":"pending"})} style={ss.btnP}>{content.saveLabel}</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RIDDORRegister() {
  const marketId = getOrgMarketId();
  const content = getNotifiableIncidentsContent(marketId);
  const [reports, setReports] = useState(()=>load("riddor_reports",[]));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(40);

  useEffect(()=>{ save("riddor_reports",reports); },[reports]);

  const liveReports = liveOrgArrayRows(reports);

  const saveReport = (r) => {
    setReports(prev=>prev.find(x=>x.id===r.id)?prev.map(x=>x.id===r.id?r:x):[r,...prev]);
    setModal(null);
  };

  const getDeadlineStatus = (r) => {
    const def = getIncidentTypeDef(content, r.riddorType);
    if (!def?.deadline||!r.incidentDate) return null;
    const deadline = new Date(addDays(r.incidentDate, def.deadline));
    const daysLeft = Math.ceil((deadline-new Date())/(1000*60*60*24));
    if (r.reportedToHSE) return { bg:"#EAF3DE", color:"#27500A", label: content.reportedLabel };
    if (daysLeft<0) return { bg:"#FCEBEB", color:"#791F1F", label:`${Math.abs(daysLeft)}d OVERDUE` };
    if (daysLeft<=2) return { bg:"#FCEBEB", color:"#791F1F", label:`${daysLeft}d left` };
    return { bg:"#FAEEDA", color:"#633806", label:`${daysLeft}d to report` };
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && <RIDDORForm report={modal.data} onSave={saveReport} onClose={()=>setModal(null)} content={content} marketId={marketId} />}

      <PageHero
        badgeText={content.badgeText}
        title={content.title}
        lead={content.lead}
        exportModuleId={content.moduleId}
        exportModuleLabel={content.exportModuleLabel}
        right={
          <button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnR}>
            {content.newReportLabel}
          </button>
        }
      />

      <RegisterModuleShell
        moduleId={content.moduleId}
        smartContext={{ items: liveReports, reports: liveReports }}
        pdfExportRows={liveReports}
        stats={buildRegisterModuleStats(content.moduleId, liveReports)}
      >
      <div style={{ padding:"10px 14px", background:"#E6F1FB", border:"0.5px solid #B5D4F4", borderRadius:8, fontSize:12, color:"#0C447C", marginBottom:20, lineHeight:1.6 }}>
        {content.lead} <a href={content.regulatorUrl} target="_blank" rel="noopener noreferrer" style={{ color:"#185FA5" }}>{content.regulatorLinkText.replace(" →", "")}</a>
      </div>

      {liveReports.length===0 ? (
        <EmptyState
          icon="📢"
          title={String(content.emptyLabel || "").replace(/\.$/, "") || "No records yet"}
          description="Prepare reportable incident paperwork before notifying the regulator."
          actionLabel={content.newReportLabel}
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {listPg.visible(liveReports).map(r=>{
            const def = getIncidentTypeDef(content, r.riddorType);
            const status = getDeadlineStatus(r);
            return (
              <div key={r.id} style={{ ...ss.card, display:"flex", gap:12, alignItems:"center", borderLeft:"3px solid #E24B4A" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:500, fontSize:14 }}>{def?.label||r.riddorType}</span>
                    {status && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:status.bg, color:status.color }}>{status.label}</span>}
                    {def?.form && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#F1EFE8", color:"#444441" }}>{def.form}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
                    <span>{fmtDate(r.incidentDate)}</span>
                    {r.location && <span>{r.location}</span>}
                    {r.injuredName && <span>{r.injuredName}</span>}
                    {r.hseReportRef && <span>Ref: {r.hseReportRef}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap" }}>
                  <button type="button" onClick={()=>printNotifiableWorksheet(r, content)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Print</button>
                  <button onClick={()=>setModal({type:"form",data:r})} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Edit</button>
                  <button onClick={()=>{
                    if (softDeleteToRecycleBin({
                      moduleId: content.moduleId,
                      moduleLabel: content.title,
                      itemType: "riddor_report",
                      itemLabel: def?.label || r.injuredName || r.id,
                      sourceKey: "riddor_reports",
                      payload: r,
                    })) setReports((prev) => replaceWithTombstone(prev, r.id));
                  }} style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                </div>
              </div>
            );
          })}
          <RegisterListPagingFooter
            hasMore={listPg.hasMore(liveReports)}
            remaining={listPg.remaining(liveReports)}
            showing={Math.min(listPg.cap, liveReports.length)}
            total={liveReports.length}
            onShowMore={listPg.showMore}
            itemLabel="reports"
            buttonStyle={ss.btn}
          />
        </div>
      )}
      </RegisterModuleShell>
    </div>
  );
}
