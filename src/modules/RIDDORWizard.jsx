import { useState, useEffect } from "react";
import { getOrgSettings } from "../components/OrgSettings";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `riddor_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const addDays = (iso, days) => { const d=new Date(iso); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };

const ss = {
  ...ms,
  btnR: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #A32D2D", background:"#FCEBEB", color:"#791F1F", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  ta: { ...ms.inp, resize:"vertical", lineHeight:1.5 },
};

const RIDDOR_TYPES = {
  fatality: { label:"Death / fatality", deadline:10, form:"F2508", urgent:true, description:"A worker or member of the public dies as a result of a work-related accident" },
  specified: { label:"Specified injury (worker)", deadline:10, form:"F2508", urgent:true, description:"Fracture (not finger/toe), amputation, loss of sight, crush injury to head/torso, burn, degloving, loss of consciousness, harm from biological agent" },
  over7day: { label:"Over-7-day incapacitation", deadline:15, form:"F2508", urgent:false, description:"Worker unable to perform normal duties for more than 7 consecutive days (not counting day of accident)" },
  dangerous_occurrence: { label:"Dangerous occurrence", deadline:10, form:"F2508", urgent:true, description:"Scaffold collapse, crane overturning, explosion, train collision, building collapse, radiation source uncontrolled" },
  gas_incident: { label:"Gas incident", deadline:10, form:"F2508G", urgent:true, description:"Flammable gas or vapour explosion or fire, or a gas fitting or appliance causing death or injury" },
  disease: { label:"Occupational disease", deadline:null, form:"F2508A", urgent:false, description:"Doctor notifies employer of occupational disease: carpal tunnel, cramp, dermatitis, occupational asthma, tendinitis, vibration white finger" },
  public_injury: { label:"Public injury (non-fatal)", deadline:10, form:"F2508", urgent:false, description:"Member of public taken from scene to hospital for treatment as a result of a work-related accident" },
};

const SPECIFIED_INJURIES = [
  "Fracture (other than finger, thumb or toe)",
  "Amputation of arm, hand, finger, thumb, leg, foot or toe",
  "Loss of sight or reduction in sight",
  "Crush injury to head or torso causing damage to brain or internal organs",
  "Severe burn (covering more than 10% of body, or to face, hands, feet, genitals, major joint)",
  "Degree of hypothermia requiring resuscitation or admission to hospital",
  "Loss of consciousness caused by head injury or asphyxia",
  "Any harm from absorption of any substance by inhalation, ingestion or through the skin",
  "Any degree of harm requiring resuscitation",
  "Hospitalisation for more than 24 hours",
];

const DANGEROUS_OCCURRENCES = [
  "Collapse, overturning or failure of load-bearing part of any scaffold more than 5 metres high",
  "Explosion or fire causing suspension of normal work for more than 24 hours",
  "Collapse or partial collapse of a building under construction",
  "Accidental release of any substance that may cause injury to any person",
  "Failure of any closed vessel or associated pipework forming part of a pressure system",
  "Electrical short circuit or overload attended by fire or explosion serious enough to stop plant operation",
  "Explosion, collapse or burst of any closed vessel",
  "Train collision or derailment",
  "Unintended collapse of any building",
  "Contact with overhead power line",
];

export function printRiddorF2508(form) {
  const org = getOrgSettings();
  const def = RIDDOR_TYPES[form.riddorType] || {};
  const win = window.open("", "_blank");
  const row = (a, b) => `<tr><td style="border:1px solid #333;padding:6px;width:32%;font-weight:600;background:#f5f5f5">${a}</td><td style="border:1px solid #333;padding:6px">${b ?? "—"}</td></tr>`;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>RIDDOR F2508 — draft worksheet</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;padding:16px;color:#000} h1{font-size:14px} .note{font-size:10px;color:#444;margin-top:12px} @media print{.noPrint{display:none}}</style></head><body>
  <div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid ${org.primaryColor || "#0d9488"};padding-bottom:8px;margin-bottom:12px">
    ${org.logo ? `<img src="${org.logo}" style="height:40px;max-width:100px;object-fit:contain"/>` : ""}
    <div><strong>${org.name || "Organisation"}</strong><br/><span style="font-size:10px">RIDDOR report worksheet (F2508-style) — submit via HSE online</span></div>
  </div>
  <h1>Incident / dangerous occurrence — draft record</h1>
  <p class="noPrint" style="background:#FAEEDA;padding:8px;border-radius:6px">This is a local worksheet mirroring F2508 fields. Official reporting: <a href="https://www.hse.gov.uk/riddor/report.htm">hse.gov.uk/riddor/report.htm</a></p>
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
  </table>
  <p class="note">${org.pdfFooter || "MySafeOps"}</p>
  </body></html>`);
  win.document.close();
  win.print();
}

function DeadlineAlert({ reportDate, deadlineDays }) {
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
        {overdue ? `RIDDOR deadline MISSED — was ${fmtDate(deadline)}` : `RIDDOR reporting deadline: ${fmtDate(deadline)}`}
      </div>
      <div style={{ fontSize:12 }}>
        {overdue ? `Report is ${Math.abs(daysLeft)} days overdue. Report immediately via HSE online.` : `${daysLeft} day${daysLeft!==1?"s":""} remaining. Report via HSE online portal.`}
      </div>
      <a href="https://www.hse.gov.uk/riddor/report.htm" target="_blank" rel="noopener noreferrer"
        style={{ fontSize:12, color:"inherit", display:"inline-block", marginTop:6, textDecoration:"underline" }}>
        Report on HSE website →
      </a>
    </div>
  );
}

function RIDDORForm({ report, onSave, onClose }) {
  const org = (() => { try { return JSON.parse(localStorage.getItem("mysafeops_org_settings")||"{}"); } catch { return {}; } })();
  const projects = load("mysafeops_projects",[]);

  const blank = {
    id:genId(), riddorType:"specified", projectId:"",
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
  const def = RIDDOR_TYPES[form.riddorType]||RIDDOR_TYPES.specified;

  const STEPS = ["Incident type","Incident details","Injured person","Employer","Injury & treatment","Actions & reporting","Review"];

  return (
    <div style={{ minHeight:700, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem", overflowY:"auto" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:600 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:500, fontSize:16 }}>RIDDOR report wizard</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013</div>
          </div>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {def.urgent && form.incidentDate && (
          <DeadlineAlert reportDate={form.incidentDate} deadlineDays={def.deadline} />
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
            <label style={ss.lbl}>RIDDOR reportable event type *</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
              {Object.entries(RIDDOR_TYPES).map(([k,v])=>(
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
              <label style={ss.lbl}>Date of incident *</label>
              <input type="date" value={form.incidentDate} onChange={e=>set("incidentDate",e.target.value)} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Time of incident</label>
              <input type="time" value={form.incidentTime||""} onChange={e=>set("incidentTime",e.target.value)} style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Exact location where incident occurred *</label>
              <input value={form.location||""} onChange={e=>set("location",e.target.value)} placeholder="e.g. Boiler room, Level 2, 2SFG Scunthorpe" style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Site address</label>
              <textarea value={form.siteAddress||""} onChange={e=>set("siteAddress",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:44 }} />
            </div>
            <div>
              <label style={ss.lbl}>Project</label>
              <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
                <option value="">— Select —</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {form.riddorType==="specified" && (
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Type of specified injury</label>
                <select value={form.specifiedInjuryType||""} onChange={e=>set("specifiedInjuryType",e.target.value)} style={ss.inp}>
                  <option value="">— Select —</option>
                  {SPECIFIED_INJURIES.map((i,idx)=><option key={idx} value={i}>{i}</option>)}
                </select>
              </div>
            )}
            {form.riddorType==="dangerous_occurrence" && (
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Type of dangerous occurrence</label>
                <select value={form.dangerousOccurrenceType||""} onChange={e=>set("dangerousOccurrenceType",e.target.value)} style={ss.inp}>
                  <option value="">— Select —</option>
                  {DANGEROUS_OCCURRENCES.map((i,idx)=><option key={idx} value={i}>{i}</option>)}
                </select>
              </div>
            )}
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>What work was being done at time of incident? *</label>
              <textarea value={form.workBeingDone||""} onChange={e=>set("workBeingDone",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:50 }} placeholder="Describe the activity taking place at the time of the incident…" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Description of what happened *</label>
              <textarea value={form.incidentDescription||""} onChange={e=>set("incidentDescription",e.target.value)} rows={3} style={{ ...ss.ta, minHeight:70 }} placeholder="Provide a full description of how the incident occurred…" />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Cause / contributing factors</label>
              <textarea value={form.causeOfIncident||""} onChange={e=>set("causeOfIncident",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:50 }} placeholder="What were the direct and underlying causes?" />
            </div>
          </div>
        )}

        {/* step 2 — injured person */}
        {step===2 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Full name of injured person</label>
              <input value={form.injuredName||""} onChange={e=>set("injuredName",e.target.value)} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Date of birth</label>
              <input type="date" value={form.injuredDob||""} onChange={e=>set("injuredDob",e.target.value)} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Gender</label>
              <select value={form.injuredGender||""} onChange={e=>set("injuredGender",e.target.value)} style={ss.inp}>
                <option value="">— Select —</option>
                <option>Male</option><option>Female</option><option>Prefer not to say</option>
              </select>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Job title / trade</label>
              <input value={form.injuredJobTitle||""} onChange={e=>set("injuredJobTitle",e.target.value)} placeholder="e.g. Pipefitter, Electrician, Site manager" style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Witnesses</label>
              <textarea value={form.witnesses||""} onChange={e=>set("witnesses",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:44 }} placeholder="Names of any witnesses to the incident…" />
            </div>
          </div>
        )}

        {/* step 3 — employer */}
        {step===3 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Employer / organisation name</label>
              <input value={form.employerName||""} onChange={e=>set("employerName",e.target.value)} style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Employer address</label>
              <textarea value={form.employerAddress||""} onChange={e=>set("employerAddress",e.target.value)} rows={2} style={{ ...ss.ta, minHeight:44 }} />
            </div>
          </div>
        )}

        {/* step 4 — injury & treatment */}
        {step===4 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Treatment received</label>
              <select value={form.treatmentReceived||""} onChange={e=>set("treatmentReceived",e.target.value)} style={ss.inp}>
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
                  <label style={ss.lbl}>Hospital name</label>
                  <input value={form.hospitalName||""} onChange={e=>set("hospitalName",e.target.value)} style={ss.inp} />
                </div>
                <div>
                  <label style={ss.lbl}>Date of treatment</label>
                  <input type="date" value={form.treatmentDate||""} onChange={e=>set("treatmentDate",e.target.value)} style={ss.inp} />
                </div>
              </>
            )}
            {form.riddorType==="over7day" && (
              <>
                <div>
                  <label style={ss.lbl}>Number of days absent</label>
                  <input type="number" value={form.daysAbsent||""} onChange={e=>set("daysAbsent",e.target.value)} style={ss.inp} />
                </div>
                <div>
                  <label style={ss.lbl}>Actual / expected return to work</label>
                  <input type="date" value={form.returnToWorkDate||""} onChange={e=>set("returnToWorkDate",e.target.value)} style={ss.inp} />
                </div>
              </>
            )}
          </div>
        )}

        {/* step 5 — actions & reporting */}
        {step===5 && (
          <div>
            <div style={{ marginBottom:12 }}>
              <label style={ss.lbl}>Immediate actions taken</label>
              <textarea value={form.immediateActions||""} onChange={e=>set("immediateActions",e.target.value)} rows={3} style={{ ...ss.ta, minHeight:60 }} placeholder="Describe immediate actions taken: first aid given, area made safe, equipment isolated, emergency services called…" />
            </div>
            <div style={{ padding:"10px 14px", background:"#E6F1FB", borderRadius:8, fontSize:12, color:"#0C447C", marginBottom:14 }}>
              Report online at: <a href="https://www.hse.gov.uk/riddor/report.htm" target="_blank" rel="noopener noreferrer" style={{ color:"#185FA5" }}>hse.gov.uk/riddor/report.htm</a>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"flex", gap:10, alignItems:"center", cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={form.reportedToHSE||false} onChange={e=>set("reportedToHSE",e.target.checked)}
                  style={{ accentColor:"#0d9488", width:15, height:15 }} />
                RIDDOR report submitted to HSE
              </label>
            </div>
            {form.reportedToHSE && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
                <div>
                  <label style={ss.lbl}>HSE report reference number</label>
                  <input value={form.hseReportRef||""} onChange={e=>set("hseReportRef",e.target.value)} placeholder="Reference from HSE confirmation" style={ss.inp} />
                </div>
                <div>
                  <label style={ss.lbl}>Date reported to HSE</label>
                  <input type="date" value={form.hseReportDate||""} onChange={e=>set("hseReportDate",e.target.value)} style={ss.inp} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* step 6 — review */}
        {step===6 && (
          <div>
            <div style={{ ...ss.card, border:"0.5px solid #9FE1CB", marginBottom:14 }}>
              <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>RIDDOR report summary</div>
              {[
                ["Type", RIDDOR_TYPES[form.riddorType]?.label],
                ["Date", fmtDate(form.incidentDate)],
                ["Location", form.location||"—"],
                ["Injured person", form.injuredName||"—"],
                ["Employer", form.employerName||"—"],
                ["HSE form", RIDDOR_TYPES[form.riddorType]?.form],
                ["Deadline", form.incidentDate&&RIDDOR_TYPES[form.riddorType]?.deadline ? `${fmtDate(addDays(form.incidentDate,RIDDOR_TYPES[form.riddorType].deadline))}` : "—"],
                ["Reported to HSE", form.reportedToHSE ? `Yes — Ref: ${form.hseReportRef||"—"}` : "Not yet reported"],
              ].map(([l,v])=>(
                <div key={l} style={{ display:"flex", gap:10, padding:"5px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13 }}>
                  <span style={{ color:"var(--color-text-secondary)", minWidth:130 }}>{l}</span>
                  <span style={{ fontWeight:500 }}>{v||"—"}</span>
                </div>
              ))}
            </div>
            {!form.reportedToHSE && (
              <div style={{ padding:"10px 14px", background:"#FCEBEB", borderRadius:8, fontSize:12, color:"#791F1F", marginBottom:14 }}>
                This incident has not yet been reported to HSE. Please report at hse.gov.uk/riddor/report.htm
              </div>
            )}
            <div style={{ marginTop:12 }}>
              <button type="button" onClick={()=>printRiddorF2508(form)} style={{ ...ss.btn, fontSize:12 }}>Print F2508-style worksheet</button>
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
              : <button onClick={()=>onSave({...form,status:form.reportedToHSE?"reported":"pending"})} style={ss.btnP}>Save RIDDOR record</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RIDDORRegister() {
  const [reports, setReports] = useState(()=>load("riddor_reports",[]));
  const [modal, setModal] = useState(null);

  useEffect(()=>{ save("riddor_reports",reports); },[reports]);

  const saveReport = (r) => {
    setReports(prev=>prev.find(x=>x.id===r.id)?prev.map(x=>x.id===r.id?r:x):[r,...prev]);
    setModal(null);
  };

  const getDeadlineStatus = (r) => {
    const def = RIDDOR_TYPES[r.riddorType];
    if (!def?.deadline||!r.incidentDate) return null;
    const deadline = new Date(addDays(r.incidentDate, def.deadline));
    const daysLeft = Math.ceil((deadline-new Date())/(1000*60*60*24));
    if (r.reportedToHSE) return { bg:"#EAF3DE", color:"#27500A", label:"Reported to HSE" };
    if (daysLeft<0) return { bg:"#FCEBEB", color:"#791F1F", label:`${Math.abs(daysLeft)}d OVERDUE` };
    if (daysLeft<=2) return { bg:"#FCEBEB", color:"#791F1F", label:`${daysLeft}d left` };
    return { bg:"#FAEEDA", color:"#633806", label:`${daysLeft}d to report` };
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && <RIDDORWizard report={modal.data} onSave={saveReport} onClose={()=>setModal(null)} />}

      <PageHero
        badgeText="RID"
        title="RIDDOR register"
        lead="Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013. Deadlines and HSE reporting links below."
        right={
          <button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnR}>
            + New RIDDOR report
          </button>
        }
      />

      <div style={{ padding:"10px 14px", background:"#E6F1FB", border:"0.5px solid #B5D4F4", borderRadius:8, fontSize:12, color:"#0C447C", marginBottom:20, lineHeight:1.6 }}>
        RIDDOR requires employers to report work-related deaths, specified injuries and over-7-day injuries within 10–15 days. Report at <a href="https://www.hse.gov.uk/riddor/report.htm" target="_blank" rel="noopener noreferrer" style={{ color:"#185FA5" }}>hse.gov.uk/riddor/report.htm</a>
      </div>

      {reports.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No RIDDOR reports recorded.</p>
          <button onClick={()=>setModal({type:"form"})} style={ss.btnR}>+ Report an incident</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {reports.map(r=>{
            const def = RIDDOR_TYPES[r.riddorType]||{};
            const status = getDeadlineStatus(r);
            return (
              <div key={r.id} style={{ ...ss.card, display:"flex", gap:12, alignItems:"center", borderLeft:"3px solid #E24B4A" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:500, fontSize:14 }}>{def.label||r.riddorType}</span>
                    {status && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:status.bg, color:status.color }}>{status.label}</span>}
                    {def.form && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#F1EFE8", color:"#444441" }}>{def.form}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
                    <span>{fmtDate(r.incidentDate)}</span>
                    {r.location && <span>{r.location}</span>}
                    {r.injuredName && <span>{r.injuredName}</span>}
                    {r.hseReportRef && <span>HSE ref: {r.hseReportRef}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap" }}>
                  <button type="button" onClick={()=>printRiddorF2508(r)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Print F2508</button>
                  <button onClick={()=>setModal({type:"form",data:r})} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Edit</button>
                  <button onClick={()=>{ if(confirm("Delete?")) setReports(prev=>prev.filter(x=>x.id!==r.id)); }} style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
