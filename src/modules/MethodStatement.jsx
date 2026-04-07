import { useState, useEffect } from "react";

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => `${k}_${getOrgId()}`;
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb)); } catch { return fb; } };
const save = (k, v) => localStorage.setItem(sk(k), JSON.stringify(v));
const genId = () => `ms_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };

const ss = {
  btn:  { padding:"7px 14px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #085041", background:"#0d9488", color:"#E1F5EE", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnO: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  inp:  { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box" },
  lbl:  { display:"block", fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:4 },
  card: { background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, padding:"1.25rem" },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 },
  sec:  { fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, marginTop:20 },
};

const PPE_OPTIONS = [
  "Hard hat","Safety footwear","Hi-vis vest","Safety glasses","Hearing protection","Dust mask (FFP2)",
  "Dust mask (FFP3)","Nitrile gloves","Cut-resistant gloves","Leather welding gloves",
  "Chemical resistant gloves","Face shield","Welding helmet","Full harness","Half-face respirator",
  "Coveralls","Safety harness & lanyard","Chemical resistant apron",
];

const PLANT_SUGGESTIONS = [
  "Angle grinder","Power drill (110V)","MEWP / cherry picker","Mobile scaffold tower",
  "TIG welder","Fork lift truck (FLT)","Pipe press tool","Hydraulic jack",
  "CAT scanner","Vacuum excavator","Generator","Pressure test pump",
  "Cable drum","Pipe threading machine","Torque wrench set",
];

const STEP_TEMPLATES = {
  mobilisation: [
    "Arrive on site, sign in and complete site induction",
    "Undertake site survey and identify any hazards in the work area",
    "Set up compound/exclusion zone and erect appropriate signage",
    "Issue permits to work and confirm isolation procedures with site manager",
    "Brief all operatives on the method statement and RAMS before works commence",
  ],
  electrical: [
    "Isolate electrical supply to work area and apply lock-off device",
    "Test with approved voltage indicator to confirm circuit is dead (GS38)",
    "Install warning notices at isolation point",
    "Carry out work in accordance with BS 7671",
    "Test installation on completion before re-energising",
    "Re-energise supply under supervision and confirm correct operation",
  ],
  mechanical: [
    "Confirm isolation of all services (electric, gas, water, steam) to work area",
    "Apply LOTO (lock-out tag-out) to all energy isolation points",
    "Drain down pipework and confirm system is pressure-free",
    "Carry out mechanical works in accordance with design drawings",
    "Pressure test pipework/system on completion; record test pressure and duration",
    "Remove LOTO devices and restore services; confirm with site manager",
  ],
  height: [
    "Erect and inspect access equipment (scaffold/MEWP) before use",
    "Issue MEWP daily check sheet; record any defects",
    "Brief operatives on exclusion zone and falling object precautions",
    "Fit harness and connect to anchor point before leaving platform",
    "Carry out work; lower all tools and materials in controlled manner",
    "Dismantle access equipment; inspect for damage before storage",
  ],
  demobilisation: [
    "Clear all waste materials and redundant equipment from work area",
    "Clean work area to at least the same standard as found",
    "Complete all as-built drawings and test/inspection records",
    "Obtain sign-off from site manager / client representative",
    "Return all permits and confirm systems restored to normal operation",
    "Remove site compound; confirm all consumables correctly disposed",
  ],
};

function PillToggle({ options, selected, onChange }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
      {options.map(o => {
        const sel = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(sel ? selected.filter(x=>x!==o) : [...selected,o])}
            style={{ padding:"3px 10px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
              background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)",
              color:sel?"#E1F5EE":"var(--color-text-primary)",
              border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)" }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function StepEditor({ steps, setSteps }) {
  const [newStep, setNewStep] = useState({ title:"", description:"", responsible:"", duration:"" });
  const [template, setTemplate] = useState("");

  const addStep = () => {
    if (!newStep.title.trim()) return;
    setSteps(prev => [...prev, { ...newStep, id:genId(), seq:prev.length+1 }]);
    setNewStep({ title:"", description:"", responsible:"", duration:"" });
  };

  const applyTemplate = () => {
    if (!template) return;
    const tmplSteps = STEP_TEMPLATES[template] || [];
    const newSteps = tmplSteps.map((desc, i) => ({
      id: genId(), seq: steps.length + i + 1,
      title: desc.split(" ").slice(0,5).join(" ") + "…",
      description: desc, responsible: "", duration: "",
    }));
    setSteps(prev => [...prev, ...newSteps]);
    setTemplate("");
  };

  const updateStep = (id, field, val) => setSteps(prev => prev.map(s => s.id===id ? {...s,[field]:val} : s));
  const removeStep = (id) => setSteps(prev => prev.filter(s => s.id!==id).map((s,i) => ({...s,seq:i+1})));
  const moveStep = (id, dir) => {
    setSteps(prev => {
      const idx = prev.findIndex(s=>s.id===id);
      const next = idx + dir;
      if (next<0||next>=prev.length) return prev;
      const arr = [...prev];
      [arr[idx],arr[next]] = [arr[next],arr[idx]];
      return arr.map((s,i) => ({...s,seq:i+1}));
    });
  };

  return (
    <div>
      {/* template loader */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <select value={template} onChange={e=>setTemplate(e.target.value)} style={{ ...ss.inp, width:"auto", flex:1 }}>
          <option value="">Load step template…</option>
          <option value="mobilisation">Mobilisation sequence</option>
          <option value="electrical">Electrical isolation sequence</option>
          <option value="mechanical">Mechanical LOTO sequence</option>
          <option value="height">Work at height sequence</option>
          <option value="demobilisation">Demobilisation sequence</option>
        </select>
        <button disabled={!template} onClick={applyTemplate} style={{ ...ss.btn, opacity:template?1:0.4 }}>
          Add template steps
        </button>
      </div>

      {/* step list */}
      {steps.map((s,i) => (
        <div key={s.id} style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
          <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background:"#0d9488", color:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, flexShrink:0 }}>{s.seq}</div>
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <label style={ss.lbl}>Step title</label>
                <input value={s.title} onChange={e=>updateStep(s.id,"title",e.target.value)} style={ss.inp} placeholder="e.g. Isolate electrical supply" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <label style={ss.lbl}>Responsible</label>
                  <input value={s.responsible||""} onChange={e=>updateStep(s.id,"responsible",e.target.value)} style={ss.inp} placeholder="e.g. Electrician" />
                </div>
                <div>
                  <label style={ss.lbl}>Duration</label>
                  <input value={s.duration||""} onChange={e=>updateStep(s.id,"duration",e.target.value)} style={ss.inp} placeholder="e.g. 30 min" />
                </div>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Description / detail</label>
                <textarea value={s.description||""} onChange={e=>updateStep(s.id,"description",e.target.value)}
                  rows={2} style={{ ...ss.ta, minHeight:42 }} placeholder="Detailed description of this step…" />
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
              <button onClick={()=>moveStep(s.id,-1)} disabled={i===0} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:i===0?0.3:1 }}>↑</button>
              <button onClick={()=>moveStep(s.id,1)} disabled={i===steps.length-1} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:i===steps.length-1?0.3:1 }}>↓</button>
              <button onClick={()=>removeStep(s.id)} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
            </div>
          </div>
        </div>
      ))}

      {/* add new step */}
      <div style={{ border:"0.5px dashed var(--color-border-secondary,#ccc)", borderRadius:8, padding:"10px 12px" }}>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8 }}>Add step manually</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <input value={newStep.title} onChange={e=>setNewStep(n=>({...n,title:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&addStep()}
              placeholder="Step title…" style={ss.inp} />
          </div>
          <input value={newStep.responsible} onChange={e=>setNewStep(n=>({...n,responsible:e.target.value}))} placeholder="Responsible person / role" style={ss.inp} />
          <input value={newStep.duration} onChange={e=>setNewStep(n=>({...n,duration:e.target.value}))} placeholder="Estimated duration" style={ss.inp} />
          <textarea value={newStep.description} onChange={e=>setNewStep(n=>({...n,description:e.target.value}))}
            rows={2} placeholder="Step description…" style={{ ...ss.ta, minHeight:40, gridColumn:"1/-1" }} />
        </div>
        <button disabled={!newStep.title.trim()} onClick={addStep} style={{ ...ss.btn, opacity:newStep.title.trim()?1:0.4, fontSize:12 }}>
          + Add step
        </button>
      </div>
    </div>
  );
}

function MSForm({ ms, onSave, onClose }) {
  const workers = load("mysafeops_workers", []);
  const projects = load("mysafeops_projects", []);

  const blank = {
    id: genId(), title:"", location:"", projectId:"",
    jobRef:"", client:"", date:today(), revision:"1A",
    leadEngineer:"", preparedBy:"", approvedBy:"",
    scope:"", restrictions:"",
    steps:[], plant:[], materials:[],
    ppeRequired:[], operativeIds:[],
    emergencyProcedure:"", wasteDisposal:"",
    relatedRamsId:"", notes:"",
    status:"draft", createdAt:new Date().toISOString(),
  };

  const [form, setForm] = useState(ms ? {...ms} : blank);
  const [newPlant, setNewPlant] = useState("");
  const [newMat, setNewMat] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addPlant = () => { if (!newPlant.trim()) return; set("plant",[...form.plant,newPlant.trim()]); setNewPlant(""); };
  const addMat = () => { if (!newMat.trim()) return; set("materials",[...form.materials,newMat.trim()]); setNewMat(""); };
  const ramsDocs = load("rams_builder_docs", []);

  const valid = form.title?.trim() && form.location?.trim();
  const tabs = [["info","Document info"],["steps","Work sequence"],["resources","Plant & materials"],["ppe","PPE & safety"],["preview","Preview"]];

  return (
    <div style={{ minHeight:700, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem", overflowY:"auto" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:680 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:500, fontSize:16 }}>{ms?"Edit method statement":"New method statement"}</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Step-by-step work sequence document</div>
          </div>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {/* tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:20, flexWrap:"wrap" }}>
          {tabs.map(([t,l]) => (
            <button key={t} onClick={()=>setActiveTab(t)} style={{
              ...ss.btn, borderRadius:"6px 6px 0 0",
              borderBottom:activeTab===t?"2px solid #f97316":"2px solid transparent",
              background:activeTab===t?"var(--color-background-secondary,#f7f7f5)":"transparent",
              borderLeft:"none", borderRight:"none", borderTop:"none",
              color:activeTab===t?"#f97316":"var(--color-text-secondary)",
              fontWeight:activeTab===t?500:400, fontSize:13, padding:"6px 12px",
            }}>{l}</button>
          ))}
        </div>

        {/* INFO TAB */}
        {activeTab==="info" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Method statement title *</label>
                <input value={form.title} onChange={e=>set("title",e.target.value)}
                  placeholder="e.g. Replacement of kettle tank — 2SFG Scunthorpe" style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Location / site *</label>
                <input value={form.location} onChange={e=>set("location",e.target.value)} placeholder="Site address" style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Project</label>
                <select value={form.projectId} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
                  <option value="">— Select —</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={ss.lbl}>Client</label>
                <input value={form.client||""} onChange={e=>set("client",e.target.value)} placeholder="Client company name" style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Job reference</label>
                <input value={form.jobRef||""} onChange={e=>set("jobRef",e.target.value)} placeholder="e.g. FP1-KETTLE-001" style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Date</label>
                <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Revision</label>
                <input value={form.revision||"1A"} onChange={e=>set("revision",e.target.value)} style={{ ...ss.inp, width:"auto" }} />
              </div>
              <div>
                <label style={ss.lbl}>Lead engineer</label>
                <input value={form.leadEngineer||""} onChange={e=>set("leadEngineer",e.target.value)} placeholder="Name" style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Prepared by</label>
                <input value={form.preparedBy||""} onChange={e=>set("preparedBy",e.target.value)} placeholder="Name / position" style={ss.inp} />
              </div>
              <div>
                <label style={ss.lbl}>Approved by</label>
                <input value={form.approvedBy||""} onChange={e=>set("approvedBy",e.target.value)} placeholder="Name / position" style={ss.inp} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Scope of works</label>
                <textarea value={form.scope||""} onChange={e=>set("scope",e.target.value)} rows={3}
                  placeholder="Describe the full scope of work covered by this method statement…" style={ss.ta} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Restrictions / constraints</label>
                <textarea value={form.restrictions||""} onChange={e=>set("restrictions",e.target.value)} rows={2}
                  placeholder="e.g. Works only during non-production hours. Client's site rules apply." style={ss.ta} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Linked RAMS document</label>
                <select value={form.relatedRamsId||""} onChange={e=>set("relatedRamsId",e.target.value)} style={ss.inp}>
                  <option value="">— None —</option>
                  {ramsDocs.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={ss.lbl}>Operatives</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {workers.map(w=>{
                    const sel=(form.operativeIds||[]).includes(w.id);
                    return (
                      <button key={w.id} type="button" onClick={()=>set("operativeIds",sel?(form.operativeIds||[]).filter(id=>id!==w.id):[...(form.operativeIds||[]),w.id])}
                        style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                          background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)",
                          color:sel?"#E1F5EE":"var(--color-text-primary)",
                          border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)" }}>
                        {w.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEPS TAB */}
        {activeTab==="steps" && (
          <StepEditor steps={form.steps||[]} setSteps={v=>set("steps",typeof v==="function"?v(form.steps||[]):v)} />
        )}

        {/* RESOURCES TAB */}
        {activeTab==="resources" && (
          <div>
            <div style={ss.sec}>Plant and equipment</div>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                {(form.plant||[]).map((p,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:12, background:"var(--color-background-secondary,#f7f7f5)", border:"0.5px solid var(--color-border-secondary,#ccc)" }}>
                    {p}
                    <button onClick={()=>set("plant",(form.plant||[]).filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"#A32D2D", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={ss.lbl}>Suggestions</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {PLANT_SUGGESTIONS.filter(p=>!(form.plant||[]).includes(p)).map(p=>(
                    <button key={p} onClick={()=>set("plant",[...(form.plant||[]),p])}
                      style={{ padding:"2px 8px", borderRadius:20, fontSize:11, cursor:"pointer", fontFamily:"DM Sans,sans-serif", background:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)", border:"0.5px solid var(--color-border-secondary,#ccc)" }}>
                      + {p}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={newPlant} onChange={e=>setNewPlant(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlant()}
                  placeholder="Add plant item…" style={{ ...ss.inp, flex:1 }} />
                <button onClick={addPlant} style={ss.btnP}>Add</button>
              </div>
            </div>

            <div style={ss.sec}>Key materials</div>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                {(form.materials||[]).map((m,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:12, background:"var(--color-background-secondary,#f7f7f5)", border:"0.5px solid var(--color-border-secondary,#ccc)" }}>
                    {m}
                    <button onClick={()=>set("materials",(form.materials||[]).filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"#A32D2D", fontSize:14, lineHeight:1, padding:0 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={newMat} onChange={e=>setNewMat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMat()}
                  placeholder="Add material…" style={{ ...ss.inp, flex:1 }} />
                <button onClick={addMat} style={ss.btnP}>Add</button>
              </div>
            </div>

            <div style={ss.sec}>Emergency & waste</div>
            <div style={{ marginBottom:12 }}>
              <label style={ss.lbl}>Emergency procedure</label>
              <textarea value={form.emergencyProcedure||""} onChange={e=>set("emergencyProcedure",e.target.value)} rows={3}
                placeholder="e.g. In the event of an emergency, stop all works, raise the alarm and evacuate to muster point…" style={ss.ta} />
            </div>
            <div>
              <label style={ss.lbl}>Waste disposal method</label>
              <textarea value={form.wasteDisposal||""} onChange={e=>set("wasteDisposal",e.target.value)} rows={2}
                placeholder="e.g. All waste to be segregated and removed by licensed waste carrier…" style={ss.ta} />
            </div>
          </div>
        )}

        {/* PPE TAB */}
        {activeTab==="ppe" && (
          <div>
            <div style={ss.sec}>Required PPE for this method statement</div>
            <PillToggle options={PPE_OPTIONS} selected={form.ppeRequired||[]}
              onChange={v=>set("ppeRequired",v)} />
            <div style={{ marginBottom:20 }} />
            <div style={ss.sec}>Additional notes</div>
            <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} rows={4}
              placeholder="Any additional safety notes, special conditions or site-specific requirements…" style={ss.ta} />
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab==="preview" && (
          <div>
            <div style={{ ...ss.card, border:"0.5px solid #9FE1CB", marginBottom:16 }}>
              <div style={{ background:"#f97316", borderRadius:6, padding:"8px 12px", color:"#fff", fontSize:14, fontWeight:500, textAlign:"center", marginBottom:12 }}>
                METHOD STATEMENT — {form.title||"Untitled"}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12, fontSize:12 }}>
                {[["Location",form.location],["Date",fmtDate(form.date)],["Ref",form.jobRef||"—"],["Client",form.client||"—"],["Lead engineer",form.leadEngineer||"—"],["Revision",form.revision||"1A"]].map(([l,v])=>(
                  <div key={l} style={{ background:"var(--color-background-secondary,#f7f7f5)", padding:"6px 8px", borderRadius:6 }}>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{l}</div>
                    <div style={{ fontWeight:500, marginTop:1 }}>{v}</div>
                  </div>
                ))}
              </div>
              {form.scope && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:12, lineHeight:1.6 }}>{form.scope}</div>}
              <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                {(form.steps||[]).length} work steps · {(form.plant||[]).length} plant items · {(form.ppeRequired||[]).length} PPE items
              </div>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>printMS(form,workers,projects)} style={ss.btn}>
                <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="1" width="10" height="10" rx="1"/><path d="M1 8h14v6H1z"/><path d="M5 14v-3h6v3"/></svg>
                Print / PDF
              </button>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:20, paddingTop:16, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <div style={{ display:"flex", gap:8 }}>
            {activeTab!=="info" && <button onClick={()=>setActiveTab(tabs[tabs.findIndex(t=>t[0]===activeTab)-1][0])} style={ss.btn}>← Back</button>}
            {activeTab!=="preview" ? (
              <button onClick={()=>setActiveTab(tabs[tabs.findIndex(t=>t[0]===activeTab)+1][0])} style={ss.btnP}>Next →</button>
            ) : (
              <button disabled={!valid} onClick={()=>onSave(form)} style={{ ...ss.btnO, opacity:valid?1:0.4 }}>Save method statement</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function printMS(form, workers, projects) {
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const operatives = (form.operativeIds||[]).map(id=>workerMap[id]).filter(Boolean);

  const stepsHTML = (form.steps||[]).map(s=>`
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:11px;font-weight:bold;width:40px">${s.seq}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;font-weight:500">${s.title}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px">${s.description||""}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;white-space:nowrap">${s.responsible||""}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;white-space:nowrap">${s.duration||""}</td>
    </tr>`).join("");

  const sigRows = operatives.map(n=>`
    <tr style="height:44px">
      <td style="padding:6px;border:1px solid #ddd;font-size:12px">${n}</td>
      <td style="border:1px solid #ddd"></td>
      <td style="border:1px solid #ddd"></td>
    </tr>`).join("");

  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>MS — ${form.title}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:20px}
  h1{font-size:15px;font-weight:bold;background:#f97316;color:#fff;padding:8px 12px;margin:0 0 12px;text-align:center}
  h2{font-size:12px;font-weight:bold;background:#f5f5f5;padding:5px 8px;margin:12px 0 6px;border-left:3px solid #f97316}
  .hgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .hcell{border:0.5px solid #ccc;padding:5px 8px}.hcell .l{font-size:10px;color:#666;font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#0f172a;color:#fff;padding:6px 8px;font-size:11px;text-align:left;border:1px solid #0f172a}
  .pill{display:inline-block;padding:1px 8px;border-radius:20px;font-size:10px;background:#e5f7f0;margin:2px}
  @media print{body{padding:10px}h1,h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
  </head><body>
  <h1>METHOD STATEMENT — MySafeOps</h1>
  <div class="hgrid">
    <div class="hcell"><div class="l">Document title</div>${form.title}</div>
    <div class="hcell"><div class="l">Location</div>${form.location}</div>
    <div class="hcell"><div class="l">Client</div>${form.client||"—"}</div>
    <div class="hcell"><div class="l">Job reference</div>${form.jobRef||"—"}</div>
    <div class="hcell"><div class="l">Date</div>${fmtDate(form.date)}</div>
    <div class="hcell"><div class="l">Revision</div>${form.revision||"1A"}</div>
    <div class="hcell"><div class="l">Lead engineer</div>${form.leadEngineer||"—"}</div>
    <div class="hcell"><div class="l">Prepared by</div>${form.preparedBy||"—"}</div>
    <div class="hcell"><div class="l">Approved by</div>${form.approvedBy||"—"}</div>
  </div>
  ${form.scope?`<h2>Scope of works</h2><p style="font-size:12px;line-height:1.6;margin:0 0 12px">${form.scope}</p>`:""}
  ${form.restrictions?`<h2>Restrictions</h2><p style="font-size:12px;line-height:1.6;margin:0 0 12px">${form.restrictions}</p>`:""}
  ${(form.steps||[]).length>0?`<h2>Work sequence</h2>
  <table><thead><tr><th style="width:40px">Step</th><th style="width:20%">Activity</th><th>Description</th><th style="width:15%">Responsible</th><th style="width:12%">Duration</th></tr></thead>
  <tbody>${stepsHTML}</tbody></table>`:""}
  ${(form.plant||[]).length>0?`<h2>Plant and equipment</h2><p style="font-size:12px">${form.plant.map(p=>`<span class="pill">${p}</span>`).join("")}</p>`:""}
  ${(form.materials||[]).length>0?`<h2>Key materials</h2><p style="font-size:12px">${form.materials.map(m=>`<span class="pill">${m}</span>`).join("")}</p>`:""}
  ${(form.ppeRequired||[]).length>0?`<h2>Required PPE</h2><p style="font-size:12px">${form.ppeRequired.map(p=>`<span class="pill">${p}</span>`).join("")}</p>`:""}
  ${form.emergencyProcedure?`<h2>Emergency procedure</h2><p style="font-size:12px;line-height:1.6">${form.emergencyProcedure}</p>`:""}
  ${form.wasteDisposal?`<h2>Waste disposal</h2><p style="font-size:12px;line-height:1.6">${form.wasteDisposal}</p>`:""}
  ${operatives.length>0?`<h2>Operative signatures</h2>
  <table><thead><tr><th style="width:35%">Name</th><th style="width:40%">Signature</th><th style="width:25%">Date</th></tr></thead>
  <tbody>${sigRows}</tbody></table>`:""}
  <p style="font-size:10px;color:#999;margin-top:16px">Generated by MySafeOps · Rev ${form.revision||"1A"} · ${fmtDate(form.date)}</p>
  </body></html>`);
  win.document.close();
  win.print();
}

export default function MethodStatement() {
  const [docs, setDocs] = useState(()=>load("method_statements",[]));
  const [workers] = useState(()=>load("mysafeops_workers",[]));
  const [projects] = useState(()=>load("mysafeops_projects",[]));
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(()=>{ save("method_statements",docs); },[docs]);

  const saveDoc = (doc) => {
    setDocs(prev => prev.find(d=>d.id===doc.id) ? prev.map(d=>d.id===doc.id?doc:d) : [doc,...prev]);
    setModal(null);
  };

  const deleteDoc = (id) => { if(confirm("Delete this method statement?")) setDocs(prev=>prev.filter(d=>d.id!==id)); };

  const filtered = docs.filter(d => {
    if (filterStatus && d.status!==filterStatus) return false;
    if (search && !d.title?.toLowerCase().includes(search.toLowerCase()) && !d.location?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && <MSForm ms={modal.data} onSave={saveDoc} onClose={()=>setModal(null)} />}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:8 }}>
        <div>
          <h2 style={{ fontWeight:500, fontSize:20, margin:0 }}>Method statements</h2>
          <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"2px 0 0" }}>Step-by-step work sequence with plant, materials, PPE and signatures</p>
        </div>
        <button onClick={()=>setModal({type:"form"})} style={ss.btnO}>+ New method statement</button>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ ...ss.inp, flex:1, width:"auto", minWidth:140 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="superseded">Superseded</option>
        </select>
        {(search||filterStatus)&&<button onClick={()=>{setSearch("");setFilterStatus("");}} style={{ ...ss.btn, fontSize:12 }}>Clear</button>}
      </div>

      {docs.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No method statements yet.</p>
          <button onClick={()=>setModal({type:"form"})} style={ss.btnO}>+ Create first method statement</button>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>No results match your filters.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(doc => {
            const operatives = (doc.operativeIds||[]).map(id=>workerMap[id]).filter(Boolean);
            return (
              <div key={doc.id} style={{ ...ss.card, display:"flex", gap:12, alignItems:"center" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#f97316"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--color-border-tertiary,#e5e5e5)"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:500, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.title}</span>
                    <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, flexShrink:0,
                      background:doc.status==="approved"?"#EAF3DE":doc.status==="superseded"?"#f7f7f5":"#FAEEDA",
                      color:doc.status==="approved"?"#27500A":doc.status==="superseded"?"#888":"#633806" }}>
                      {doc.status||"draft"}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
                    <span>{doc.location}</span>
                    {doc.jobRef&&<span>Ref: {doc.jobRef}</span>}
                    <span>{(doc.steps||[]).length} steps</span>
                    <span>{(doc.plant||[]).length} plant items</span>
                    <span>{fmtDate(doc.date)}</span>
                  </div>
                  {operatives.length>0&&(
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                      {operatives.map(n=><span key={n} style={{ padding:"1px 8px", borderRadius:20, fontSize:10, background:"#EAF3DE", color:"#27500A" }}>{n}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>printMS(doc,workers,projects)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Print</button>
                  <button onClick={()=>setModal({type:"form",data:doc})} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Edit</button>
                  <button onClick={()=>deleteDoc(doc.id)} style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop:20, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Method statements include: document header, step-by-step work sequence with responsible persons, plant & equipment list, key materials, PPE requirements, emergency procedure, waste disposal and operative signatures. Print-ready A4 PDF in FESS format.
      </div>
    </div>
  );
}
