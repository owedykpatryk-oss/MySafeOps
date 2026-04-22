import { useState, useEffect } from "react";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";

const genId = () => `cdm_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };

function computeNotifiable(form) {
  return (
    parseInt(form.estimatedPersonDays || 0, 10) > 500 ||
    parseInt(form.estimatedWorkers || 0, 10) > 20 ||
    parseInt(form.calendarPhaseDays || 0, 10) > 30
  );
}

const ss = {
  ...ms,
  btnO: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 },
  sec:  { fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, marginTop:20 },
};

const CDM_DUTYHOLDERS = ["Client","Principal Designer","Principal Contractor","Designer","Contractor"];
const NOTIFICATION_THRESHOLDS =
  "A project is notifiable to HSE if: construction phase will last longer than 30 working days with more than 20 workers simultaneously, OR exceeds 500 person-days of construction work. CDM 2026 reform may adjust thresholds — keep your F10 assessment under review.";

const CPP_SECTIONS = [
  { key:"projectDesc", label:"Project description and programme", placeholder:"Describe the construction works, phasing and programme…" },
  { key:"clientArrangements", label:"Client's management arrangements", placeholder:"Describe how the client will manage CDM duties, communication channels…" },
  { key:"pdArrangements", label:"Principal Designer's management arrangements", placeholder:"How will design risks be managed and communicated to contractors…" },
  { key:"pcArrangements", label:"Principal Contractor's management arrangements", placeholder:"Site management structure, supervision, competence assessment…" },
  { key:"siteRules", label:"Site rules", placeholder:"Access control, PPE requirements, permit to work system, welfare…" },
  { key:"welfare", label:"Welfare facilities", placeholder:"Toilets, washing, rest areas, drinking water, changing facilities…" },
  { key:"firstAid", label:"First aid arrangements", placeholder:"First aider name(s), first aid kit locations, nearest A&E…" },
  { key:"fire", label:"Fire and emergency arrangements", placeholder:"Evacuation procedure, muster points, emergency contacts…" },
  { key:"hazards", label:"Key project hazards and control measures", placeholder:"List significant hazards identified during design and pre-construction phase…" },
  { key:"asbestos", label:"Asbestos information", placeholder:"Summary of asbestos survey findings, location of register, management plan…" },
  { key:"services", label:"Existing services and underground hazards", placeholder:"Known utility services, results of service searches, safe dig procedures…" },
  { key:"trafficManagement", label:"Traffic management plan", placeholder:"Vehicle and pedestrian segregation, delivery management, banksman requirements…" },
  { key:"coordination", label:"Coordination between contractors", placeholder:"How multiple contractors will coordinate their activities, interface management…" },
  { key:"healthSurveillance", label:"Health surveillance", placeholder:"Any health monitoring required for specific hazards (silica, HAVs, asbestos, noise)…" },
];

function CheckItem({ label, checked, onChange, sub }) {
  return (
    <label style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", cursor:"pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ marginTop:2, accentColor:"#0d9488", width:15, height:15, flexShrink:0 }} />
      <div>
        <div style={{ fontSize:13, color:"var(--color-text-primary)", lineHeight:1.4 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{sub}</div>}
      </div>
    </label>
  );
}

function CDMForm({ cdm, onSave, onClose }) {
  const projects = load("mysafeops_projects", []);
  const blank = {
    id:genId(), projectId:"", projectTitle:"", siteAddress:"", clientName:"",
    principalDesignerName:"", principalDesignerCompany:"",
    principalContractorName:"", principalContractorCompany:"",
    startDate:"", endDate:"", estimatedWorkers:"", estimatedPersonDays:"",
    calendarPhaseDays:"",
    cdmOrgRole:"contractor",
    pciSummary:"",
    hsFileSummary:"",
    cdm2026Notes:"",
    notifiable:false, f10Submitted:false, f10Date:"",
    dutyholderChecks:{}, preConstructionInfo:{}, cppSections:{},
    status:"draft", createdAt:new Date().toISOString(), date:today(),
  };
  const [form, setForm] = useState(cdm?{...cdm}:blank);
  const [tab, setTab] = useState("project");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setNested = (parent,k,v) => setForm(f=>({...f,[parent]:{...f[parent],[k]:v}}));

  const notifiable = computeNotifiable(form);
  const completedSections = CPP_SECTIONS.filter(s=>form.cppSections?.[s.key]?.trim()).length;

  const DUTYHOLDER_CHECKS = [
    { k:"clientBriefed", label:"Client briefed on CDM 2015 duties", sub:"Client understands their duty to appoint PD and PC, provide pre-construction info" },
    { k:"pdAppointed", label:"Principal Designer formally appointed in writing", sub:"Written appointment before design work begins on notifiable projects" },
    { k:"pcAppointed", label:"Principal Contractor formally appointed in writing", sub:"Written appointment before construction phase begins" },
    { k:"preConInfoProvided", label:"Pre-construction information provided to all designers and contractors", sub:"Includes existing services, asbestos, ground conditions, constraints" },
    { k:"cppPrepared", label:"Construction Phase Plan prepared before construction begins", sub:"PC responsible; must be suitable and sufficient" },
    { k:"hsfPlanningStarted", label:"Health & Safety File planning commenced", sub:"PD responsible; to be handed to client on project completion" },
    { k:"f10Filed", label:"HSE F10 notification submitted (if notifiable)", sub:"Required 1+ weeks before construction phase begins on notifiable projects" },
    { k:"welfarePlanned", label:"Welfare facilities planned and confirmed adequate", sub:"Toilets, washing, rest area, drinking water before workers arrive on site" },
    { k:"siteRulesIssued", label:"Site rules issued to all contractors and visitors", sub:"PPE requirements, access, permit to work, emergency procedures" },
    { k:"competenceChecked", label:"Competence of all contractors checked", sub:"CSCS cards, qualifications, insurance, references reviewed" },
  ];

  const tabs = [["project","Project"],["dutyholders","Dutyholders"],["checklist","CDM checklist"],["cpp","Construction Phase Plan"],["preview","Preview"]];

  return (
    <div style={{ minHeight:700, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem", overflowY:"auto" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:660 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:500, fontSize:16 }}>CDM 2015 — {cdm?"Edit compliance pack":"New compliance pack"}</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Construction (Design & Management) Regulations 2015</div>
          </div>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {/* notifiable banner */}
        {notifiable && (
          <div style={{ padding:"8px 12px", background:"#FCEBEB", borderRadius:8, fontSize:12, color:"#791F1F", marginBottom:14, display:"flex", gap:8 }}>
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="#A32D2D" strokeWidth={1.5} style={{ flexShrink:0, marginTop:1 }}><path d="M8 3v5M8 11h.01" strokeLinecap="round"/><path d="M2 14L8 2l6 12H2z"/></svg>
            This project is <strong>notifiable to HSE</strong> — F10 notification required at least 1 week before construction begins.
          </div>
        )}

        {/* tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:20, flexWrap:"wrap" }}>
          {tabs.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              ...ss.btn, borderRadius:"6px 6px 0 0", padding:"6px 12px", fontSize:13,
              borderBottom:tab===t?"2px solid #0d9488":"2px solid transparent",
              background:tab===t?"var(--color-background-secondary,#f7f7f5)":"transparent",
              borderLeft:"none", borderRight:"none", borderTop:"none",
              color:tab===t?"#0d9488":"var(--color-text-secondary)", fontWeight:tab===t?500:400,
            }}>{l}</button>
          ))}
        </div>

        {/* PROJECT TAB */}
        {tab==="project" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
            <div style={{ gridColumn: "1/-1", padding: "10px 12px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 12, color: "#14532D", lineHeight: 1.5 }}>
              <strong>CDM 2026 readiness</strong> — HSE is reviewing CDM duties. Use the fields below to capture your organisation's CDM role, PCI summary, and Health & Safety File plan so templates stay aligned when regulations update.
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={ss.lbl}>Your CDM role (this organisation)</label>
              <select value={form.cdmOrgRole || "contractor"} onChange={(e) => set("cdmOrgRole", e.target.value)} style={ss.inp}>
                <option value="client">Client</option>
                <option value="principal_designer">Principal designer</option>
                <option value="principal_contractor">Principal contractor</option>
                <option value="contractor">Contractor</option>
                <option value="designer">Designer</option>
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={ss.lbl}>Pre-construction information (PCI) summary</label>
              <textarea
                value={form.pciSummary || ""}
                onChange={(e) => set("pciSummary", e.target.value)}
                placeholder="Key PCI received / issued — surveys, asbestos, utilities, design risks…"
                rows={3}
                style={ss.ta}
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={ss.lbl}>Health &amp; Safety File — accumulation plan</label>
              <textarea
                value={form.hsFileSummary || ""}
                onChange={(e) => set("hsFileSummary", e.target.value)}
                placeholder="What will be handed to the client; RAMS, permits, as-built safety info…"
                rows={3}
                style={ss.ta}
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={ss.lbl}>CDM 2026 tracking notes</label>
              <textarea
                value={form.cdm2026Notes || ""}
                onChange={(e) => set("cdm2026Notes", e.target.value)}
                placeholder="Links to HSE consultations, internal review dates…"
                rows={2}
                style={ss.ta}
              />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Project title *</label>
              <input value={form.projectTitle||""} onChange={e=>set("projectTitle",e.target.value)} placeholder="e.g. Kettle replacement — 2SFG Scunthorpe" style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Site address</label>
              <input value={form.siteAddress||""} onChange={e=>set("siteAddress",e.target.value)} placeholder="Full site address" style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Client name</label>
              <input value={form.clientName||""} onChange={e=>set("clientName",e.target.value)} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Project (MySafeOps)</label>
              <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
                <option value="">— Link to project —</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={ss.lbl}>Construction start date</label>
              <input type="date" value={form.startDate||""} onChange={e=>set("startDate",e.target.value)} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Estimated end date</label>
              <input type="date" value={form.endDate||""} onChange={e=>set("endDate",e.target.value)} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Max simultaneous workers</label>
              <input type="number" value={form.estimatedWorkers||""} onChange={e=>set("estimatedWorkers",e.target.value)} placeholder="e.g. 12" style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Total person-days</label>
              <input type="number" value={form.estimatedPersonDays||""} onChange={e=>set("estimatedPersonDays",e.target.value)} placeholder="e.g. 350" style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Construction phase calendar days (optional)</label>
              <input
                type="number"
                value={form.calendarPhaseDays || ""}
                onChange={(e) => set("calendarPhaseDays", e.target.value)}
                placeholder="e.g. 35 — flag if &gt; 30 for review"
                style={ss.inp}
              />
            </div>
            <div style={{ gridColumn:"1/-1", padding:"8px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)" }}>
              {NOTIFICATION_THRESHOLDS}
              <div style={{ marginTop:4, fontWeight:500, color:notifiable?"#791F1F":"#27500A" }}>
                {notifiable ? "⚠ This project IS notifiable or exceeds review threshold — verify F10 / CDM duties" : "✓ Below common notification thresholds on figures entered (confirm against current HSE guidance)"}
              </div>
            </div>
            {notifiable && (
              <>
                <div>
                  <label style={ss.lbl}>F10 submitted?</label>
                  <select value={form.f10Submitted?"yes":"no"} onChange={e=>set("f10Submitted",e.target.value==="yes")} style={ss.inp}>
                    <option value="no">Not yet submitted</option>
                    <option value="yes">Submitted</option>
                  </select>
                </div>
                {form.f10Submitted && (
                  <div>
                    <label style={ss.lbl}>F10 submission date</label>
                    <input type="date" value={form.f10Date||""} onChange={e=>set("f10Date",e.target.value)} style={ss.inp} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* DUTYHOLDERS TAB */}
        {tab==="dutyholders" && (
          <div>
            {[
              { role:"Principal Designer", fields:[["principalDesignerName","Name"],["principalDesignerCompany","Company"],["principalDesignerEmail","Email"],["principalDesignerPhone","Phone"]] },
              { role:"Principal Contractor", fields:[["principalContractorName","Name"],["principalContractorCompany","Company"],["principalContractorEmail","Email"],["principalContractorPhone","Phone"]] },
              { role:"Client CDM contact", fields:[["clientCdmContact","Contact name"],["clientCdmEmail","Email"],["clientCdmPhone","Phone"]] },
            ].map(({ role, fields }) => (
              <div key={role} style={{ marginBottom:20 }}>
                <div style={{ fontWeight:500, fontSize:13, marginBottom:10, padding:"6px 10px", background:"#E6F1FB", borderRadius:6, color:"#0C447C" }}>{role}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
                  {fields.map(([k,l])=>(
                    <div key={k}>
                      <label style={ss.lbl}>{l}</label>
                      <input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={ss.inp} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CHECKLIST TAB */}
        {tab==="checklist" && (
          <div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:14 }}>
              Track compliance with key CDM 2015 requirements. {DUTYHOLDER_CHECKS.filter(c=>form.dutyholderChecks?.[c.k]).length}/{DUTYHOLDER_CHECKS.length} complete.
            </div>
            <div style={{ height:4, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:2, marginBottom:16 }}>
              <div style={{ height:4, borderRadius:2, background:"#0d9488", transition:"width .4s",
                width:`${(DUTYHOLDER_CHECKS.filter(c=>form.dutyholderChecks?.[c.k]).length/DUTYHOLDER_CHECKS.length)*100}%` }} />
            </div>
            {DUTYHOLDER_CHECKS.map(c=>(
              <CheckItem key={c.k} label={c.label} sub={c.sub}
                checked={!!form.dutyholderChecks?.[c.k]}
                onChange={e=>setNested("dutyholderChecks",c.k,e.target.checked)} />
            ))}
          </div>
        )}

        {/* CPP TAB */}
        {tab==="cpp" && (
          <div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:14 }}>
              Construction Phase Plan — {completedSections}/{CPP_SECTIONS.length} sections completed.
            </div>
            {CPP_SECTIONS.map(sec=>(
              <div key={sec.key} style={{ marginBottom:14 }}>
                <label style={ss.lbl}>
                  {sec.label}
                  {form.cppSections?.[sec.key]?.trim() && <span style={{ marginLeft:6, color:"#1D9E75", fontSize:11 }}>✓</span>}
                </label>
                <textarea value={form.cppSections?.[sec.key]||""} onChange={e=>setNested("cppSections",sec.key,e.target.value)}
                  rows={3} placeholder={sec.placeholder} style={{ ...ss.ta, minHeight:60 }} />
              </div>
            ))}
          </div>
        )}

        {/* PREVIEW TAB */}
        {tab==="preview" && (
          <div>
            <div style={{ ...ss.card, border:"0.5px solid #9FE1CB", marginBottom:14 }}>
              <div style={{ fontWeight:500, fontSize:14, marginBottom:10 }}>{form.projectTitle||"Untitled project"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:12, marginBottom:12 }}>
                {[["Client",form.clientName||"—"],["Start",fmtDate(form.startDate)],["End",fmtDate(form.endDate)],
                  ["Workers",form.estimatedWorkers||"—"],["Person-days",form.estimatedPersonDays||"—"],["Notifiable",notifiable?"YES — F10 required":"No"]].map(([l,v])=>(
                  <div key={l} style={{ background:"var(--color-background-secondary,#f7f7f5)", padding:"6px 8px", borderRadius:6 }}>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{l}</div>
                    <div style={{ fontWeight:500, fontSize:12, color:l==="Notifiable"&&notifiable?"#791F1F":"var(--color-text-primary)" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:12, fontSize:12, color:"var(--color-text-secondary)" }}>
                <span>CDM checklist: {DUTYHOLDER_CHECKS.filter(c=>form.dutyholderChecks?.[c.k]).length}/{DUTYHOLDER_CHECKS.length}</span>
                <span>CPP sections: {completedSections}/{CPP_SECTIONS.length}</span>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>printCDM(form)} style={ss.btn}>Print / PDF</button>
            </div>
          </div>
        )}

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"space-between", marginTop:20, paddingTop:16, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {tab!=="project"&&<button onClick={()=>setTab(tabs[tabs.findIndex(t=>t[0]===tab)-1][0])} style={ss.btn}>← Back</button>}
            {tab!=="preview"
              ?<button onClick={()=>setTab(tabs[tabs.findIndex(t=>t[0]===tab)+1][0])} style={ss.btnP}>Next →</button>
              :<button onClick={()=>onSave(form)} style={ss.btnO}>Save CDM pack</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function printCDM(form) {
  const win = window.open("","_blank");
  const checked = Object.entries(form.dutyholderChecks||{}).filter(([,v])=>v).length;
  const cppFilled = CPP_SECTIONS.filter(s=>form.cppSections?.[s.key]?.trim()).length;
  const notifiable = computeNotifiable(form);
  const cppHTML = CPP_SECTIONS.filter(s=>form.cppSections?.[s.key]?.trim()).map(s=>`
    <h3 style="font-size:12px;font-weight:bold;color:#0f172a;background:#f5f5f5;padding:4px 8px;margin:12px 0 4px">${s.label}</h3>
    <p style="font-size:12px;line-height:1.6;margin:0 0 8px">${(form.cppSections[s.key]||"").replace(/\n/g,"<br/>")}</p>`).join("");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CDM — ${form.projectTitle}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:20px}
  h1{font-size:15px;background:#0d9488;color:#fff;padding:8px 12px;margin:0 0 12px}
  h2{font-size:12px;font-weight:bold;background:#f5f5f5;padding:4px 8px;margin:16px 0 6px;border-left:3px solid #0d9488}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .cell{border:0.5px solid #ccc;padding:5px 8px}.cell .l{font-size:10px;color:#666;font-weight:bold}
  @media print{h1,h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
  <h1>CDM 2015 — Construction Phase Plan — MySafeOps</h1>
  <div class="grid">
    <div class="cell"><div class="l">Project</div>${form.projectTitle||"—"}</div>
    <div class="cell"><div class="l">Client</div>${form.clientName||"—"}</div>
    <div class="cell"><div class="l">Site address</div>${form.siteAddress||"—"}</div>
    <div class="cell"><div class="l">Start date</div>${fmtDate(form.startDate)}</div>
    <div class="cell"><div class="l">End date</div>${fmtDate(form.endDate)}</div>
    <div class="cell"><div class="l">Notifiable</div><strong style="color:${notifiable?"#A32D2D":"#27500A"}">${notifiable?"YES — F10 required":"No"}</strong></div>
    <div class="cell"><div class="l">Principal Designer</div>${form.principalDesignerName||"—"} (${form.principalDesignerCompany||"—"})</div>
    <div class="cell"><div class="l">Principal Contractor</div>${form.principalContractorName||"—"} (${form.principalContractorCompany||"—"})</div>
    <div class="cell"><div class="l">CDM checklist</div>${checked}/10 complete</div>
  </div>
  <h2>Construction Phase Plan</h2>
  ${cppHTML||"<p style='color:#666'>No CPP sections completed yet.</p>"}
  <p style="font-size:10px;color:#999;margin-top:20px">Generated by MySafeOps · CDM 2015 Regulations · ${fmtDate(new Date().toISOString())}</p>
  </body></html>`);
  win.document.close(); win.print();
}

export default function CDMCompliance() {
  const [packs, setPacks] = useState(()=>load("cdm_packs",[]));
  const [modal, setModal] = useState(null);

  useEffect(()=>{ save("cdm_packs",packs); },[packs]);

  const savePack = (pack) => {
    setPacks(prev => prev.find(p=>p.id===pack.id) ? prev.map(p=>p.id===pack.id?pack:p) : [pack,...prev]);
    setModal(null);
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && <CDMForm cdm={modal.data} onSave={savePack} onClose={()=>setModal(null)} />}

      <PageHero
        badgeText="CDM"
        title="CDM 2015 compliance"
        lead="Construction Phase Plan, dutyholder checklist, F10 tracking, and CDM 2026 readiness fields (PCI / H&S File / role)."
        right={<button type="button" onClick={()=>setModal({type:"form"})} style={ss.btnP}>+ New CDM pack</button>}
      />

      <div style={{ padding:"10px 14px", background:"#E6F1FB", border:"0.5px solid #B5D4F4", borderRadius:8, fontSize:12, color:"#0C447C", marginBottom:20, lineHeight:1.6 }}>
        <strong>CDM 2015 applies to all construction projects.</strong> A Construction Phase Plan is required before any construction begins. Projects exceeding 30 working days (with 20+ simultaneous workers) or 500 person-days must be notified to HSE via F10.
      </div>

      {packs.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No CDM packs created yet.</p>
          <button onClick={()=>setModal({type:"form"})} style={ss.btnP}>+ Create first CDM pack</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {packs.map(pack=>{
            const notifiable = computeNotifiable(pack);
            const checked = Object.values(pack.dutyholderChecks||{}).filter(Boolean).length;
            const cppPct = Math.round((CPP_SECTIONS.filter(s=>pack.cppSections?.[s.key]?.trim()).length/CPP_SECTIONS.length)*100);
            return (
              <div key={pack.id} style={{ ...ss.card, display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:500, fontSize:14 }}>{pack.projectTitle||"Untitled"}</span>
                    {notifiable && <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:"#FCEBEB", color:"#791F1F" }}>Notifiable</span>}
                    {notifiable && pack.f10Submitted && <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:"#EAF3DE", color:"#27500A" }}>F10 submitted</span>}
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
                    <span>{pack.clientName||"—"}</span>
                    <span>Start: {fmtDate(pack.startDate)}</span>
                    <span>CDM checklist: {checked}/10</span>
                    <span>CPP: {cppPct}%</span>
                  </div>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0 }}>
                  <button onClick={()=>printCDM(pack)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Print</button>
                  <button onClick={()=>setModal({type:"form",data:pack})} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Edit</button>
                  <button onClick={()=>{ if(confirm("Delete?")) setPacks(p=>p.filter(x=>x.id!==pack.id)); }} style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
