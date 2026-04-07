import { useState, useEffect } from "react";
import HAZARD_LIBRARY, { TRADE_CATEGORIES, getByCategory, searchHazards, getRiskLevel, RISK_COLORS } from "./ramsAllHazards";

// ─── storage ─────────────────────────────────────────────────────────────────
const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => `${k}_${getOrgId()}`;
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb)); } catch { return fb; } };
const save = (k, v) => localStorage.setItem(sk(k), JSON.stringify(v));
const genId = () => `rams_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };

const ss = {
  btn:  { padding:"7px 14px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #085041", background:"#0d9488", color:"#E1F5EE", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnO: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  inp:  { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box" },
  lbl:  { display:"block", fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:4 },
  card: { background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, padding:"1.25rem" },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", minHeight:60, lineHeight:1.5 },
};

const RL = {
  high:   { bg:"#FCEBEB", color:"#791F1F" },
  medium: { bg:"#FAEEDA", color:"#633806" },
  low:    { bg:"#EAF3DE", color:"#27500A" },
};

function RiskBadge({ rf }) {
  const lvl = getRiskLevel({ RF: rf });
  const c = RL[lvl];
  return <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:c.bg, color:c.color }}>{rf} — {lvl}</span>;
}

// ─── Step 1 — Document info ──────────────────────────────────────────────────
function StepInfo({ form, setForm, projects, workers, onNext }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title?.trim() && form.location?.trim();

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:20 }}>
        Fill in the document header details. These appear on the cover page of the RAMS.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={ss.lbl}>Job / document title *</label>
          <input value={form.title||""} onChange={e=>set("title",e.target.value)}
            placeholder="e.g. Kettle removal and installation of new kettle" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Location / site *</label>
          <input value={form.location||""} onChange={e=>set("location",e.target.value)}
            placeholder="e.g. Two Sisters Scunthorpe" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Project</label>
          <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
            <option value="">— Select project —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={ss.lbl}>Date</label>
          <input type="date" value={form.date||today()} onChange={e=>set("date",e.target.value)} style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Lead engineer / supervisor</label>
          <input value={form.leadEngineer||""} onChange={e=>set("leadEngineer",e.target.value)}
            placeholder="e.g. D Anderson" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Job reference</label>
          <input value={form.jobRef||""} onChange={e=>set("jobRef",e.target.value)}
            placeholder="e.g. FP1-DOLAV-001" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Review due date</label>
          <input type="date" value={form.reviewDate||""} onChange={e=>set("reviewDate",e.target.value)} style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Revision</label>
          <input value={form.revision||"1A"} onChange={e=>set("revision",e.target.value)} placeholder="1A" style={{ ...ss.inp, width:"auto" }} />
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Scope of works</label>
        <textarea value={form.scope||""} onChange={e=>set("scope",e.target.value)}
          placeholder="Describe the work to be carried out…" style={ss.ta} rows={3} />
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Operatives / workers on this RAMS</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {workers.map(w=>{
            const sel = (form.operativeIds||[]).includes(w.id);
            return (
              <button key={w.id} type="button" onClick={()=>set("operativeIds", sel ? (form.operativeIds||[]).filter(id=>id!==w.id) : [...(form.operativeIds||[]),w.id])}
                style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                  background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)",
                  color:sel?"#E1F5EE":"var(--color-text-primary)",
                  border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)" }}>
                {w.name}
              </button>
            );
          })}
          {workers.length===0 && <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No workers added yet — add workers in the Workers module.</span>}
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button disabled={!valid} onClick={onNext} style={{ ...ss.btnP, opacity:valid?1:0.4 }}>
          Next — select hazards →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Hazard picker ──────────────────────────────────────────────────
function HazardPicker({ selected, onToggle, onNext, onBack }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const results = search ? searchHazards(search)
    : activeCategory === "All" ? HAZARD_LIBRARY
    : getByCategory(activeCategory);

  const categoryCounts = Object.fromEntries(
    TRADE_CATEGORIES.map(c => [c, getByCategory(c).length])
  );

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>
        Select all activities that apply to this job. You can edit each one in the next step.
        <span style={{ marginLeft:8, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:"#E6F1FB", color:"#0C447C" }}>
          {selected.length} selected
        </span>
      </div>

      {/* search */}
      <div style={{ marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search activities… e.g. welding, height, electrical isolation"
          style={ss.inp} />
      </div>

      {/* category tabs */}
      {!search && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:16 }}>
          {["All",...TRADE_CATEGORIES].map(c=>(
            <button key={c} onClick={()=>setActiveCategory(c)} style={{
              padding:"4px 10px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
              background:activeCategory===c?"#0f172a":"var(--color-background-secondary,#f7f7f5)",
              color:activeCategory===c?"#fff":"var(--color-text-secondary)",
              border:"0.5px solid var(--color-border-secondary,#ccc)",
            }}>
              {c}{c!=="All"&&categoryCounts[c]?` (${categoryCounts[c]})`:c==="All"?` (${HAZARD_LIBRARY.length})`:""}
            </button>
          ))}
        </div>
      )}

      {/* hazard list */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {results.map(h=>{
          const sel = selected.some(s=>s.id===h.id);
          const rl = getRiskLevel(h.initialRisk);
          return (
            <div key={h.id} onClick={()=>onToggle(h)}
              style={{ ...ss.card, cursor:"pointer", padding:"12px 14px",
                borderColor:sel?"#0d9488":"var(--color-border-tertiary,#e5e5e5)",
                background:sel?"#f0fdf8":"var(--color-background-primary,#fff)" }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                {/* checkbox */}
                <div style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${sel?"#0d9488":"var(--color-border-secondary,#ccc)"}`, background:sel?"#0d9488":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  {sel && <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round"/></svg>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                    <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C", fontWeight:500 }}>{h.category}</span>
                    <RiskBadge rf={h.initialRisk.RF} />
                  </div>
                  <div style={{ fontWeight:500, fontSize:13, marginBottom:2 }}>{h.activity}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{h.hazard}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>
                    {h.controlMeasures.length} control measures · PPE: {h.ppeRequired.slice(0,3).join(", ")}{h.ppeRequired.length>3?`…`:""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {results.length===0 && <div style={{ textAlign:"center", padding:"2rem", color:"var(--color-text-secondary)", fontSize:13 }}>No hazards match your search.</div>}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button onClick={onBack} style={ss.btn}>← Back</button>
        <button disabled={selected.length===0} onClick={onNext} style={{ ...ss.btnP, opacity:selected.length>0?1:0.4 }}>
          Next — review & edit ({selected.length}) →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Review / edit each row ────────────────────────────────────────
function HazardEditor({ rows, setRows, onNext, onBack }) {
  const [editing, setEditing] = useState(null);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, [field]:value} : r));
  };

  const updateControl = (id, idx, value) => {
    setRows(prev => prev.map(r => {
      if (r.id!==id) return r;
      const cms = [...r.controlMeasures];
      cms[idx] = value;
      return {...r, controlMeasures:cms};
    }));
  };

  const addControl = (id) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, controlMeasures:[...r.controlMeasures,""]} : r));
  };

  const removeControl = (id, idx) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, controlMeasures:r.controlMeasures.filter((_,i)=>i!==idx)} : r));
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id!==id));

  const moveRow = (id, dir) => {
    setRows(prev => {
      const idx = prev.findIndex(r=>r.id===id);
      const next = idx + dir;
      if (next<0||next>=prev.length) return prev;
      const arr = [...prev];
      [arr[idx],arr[next]] = [arr[next],arr[idx]];
      return arr;
    });
  };

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>
        Review and edit each hazard row. Adjust control measures, risk scores and PPE to match your specific job.
      </div>

      <div style={{ marginBottom:20 }}>
        {rows.map((r, idx) => {
          const isEditing = editing===r.id;
          const rl = getRiskLevel(r.initialRisk);
          const rlR = getRiskLevel(r.revisedRisk);
          return (
            <div key={r.id} style={{ ...ss.card, marginBottom:8, borderColor:isEditing?"#0d9488":"var(--color-border-tertiary,#e5e5e5)" }}>
              {/* collapsed header */}
              <div style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer" }} onClick={()=>setEditing(isEditing?null:r.id)}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>{r.category}</span>
                    <RiskBadge rf={r.initialRisk.RF} />
                    <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>→</span>
                    <RiskBadge rf={r.revisedRisk.RF} />
                  </div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{r.activity}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>{r.hazard}</div>
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <button onClick={e=>{e.stopPropagation();moveRow(r.id,-1);}} disabled={idx===0} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:idx===0?0.3:1 }}>↑</button>
                  <button onClick={e=>{e.stopPropagation();moveRow(r.id,1);}} disabled={idx===rows.length-1} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:idx===rows.length-1?0.3:1 }}>↓</button>
                  <button onClick={e=>{e.stopPropagation();removeRow(r.id);}} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                  <button onClick={e=>{e.stopPropagation();setEditing(isEditing?null:r.id);}} style={{ ...ss.btn, padding:"3px 10px", fontSize:11, background:isEditing?"var(--color-background-secondary,#f7f7f5)":"transparent" }}>
                    {isEditing?"Done":"Edit"}
                  </button>
                </div>
              </div>

              {/* expanded editor */}
              {isEditing && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                    <div>
                      <label style={ss.lbl}>Activity</label>
                      <input value={r.activity} onChange={e=>updateRow(r.id,"activity",e.target.value)} style={ss.inp} />
                    </div>
                    <div>
                      <label style={ss.lbl}>Hazard / additional hazard</label>
                      <input value={r.hazard} onChange={e=>updateRow(r.id,"hazard",e.target.value)} style={ss.inp} />
                    </div>
                  </div>

                  {/* risk matrix */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                    <div style={{ padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Initial risk (before controls)</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {[["L","Likelihood (H=6 M=4 L=2)","initialRisk"],["S","Severity (Fatal=6 Major=4 Minor=2)","initialRisk"]].map(([k,hint,obj])=>(
                          <div key={k}>
                            <label style={{ ...ss.lbl, marginBottom:2 }}>{k} <span style={{ fontWeight:400 }}>({hint})</span></label>
                            <select value={r[obj][k]} onChange={e=>updateRow(r.id,obj,{...r[obj],[k]:parseInt(e.target.value),RF:parseInt(e.target.value)*(k==="L"?r[obj].S:r[obj].L)})} style={{ ...ss.inp, width:"auto" }}>
                              {[2,4,6].map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, fontSize:12 }}>RF = {r.initialRisk.L} × {r.initialRisk.S} = <strong>{r.initialRisk.L*r.initialRisk.S}</strong> <RiskBadge rf={r.initialRisk.L*r.initialRisk.S} /></div>
                    </div>
                    <div style={{ padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Revised risk (after controls)</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {[["L","Likelihood","revisedRisk"],["S","Severity","revisedRisk"]].map(([k,hint,obj])=>(
                          <div key={k}>
                            <label style={{ ...ss.lbl, marginBottom:2 }}>{k}</label>
                            <select value={r[obj][k]} onChange={e=>updateRow(r.id,obj,{...r[obj],[k]:parseInt(e.target.value),RF:parseInt(e.target.value)*(k==="L"?r[obj].S:r[obj].L)})} style={{ ...ss.inp, width:"auto" }}>
                              {[2,4,6].map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, fontSize:12 }}>RF = {r.revisedRisk.L} × {r.revisedRisk.S} = <strong>{r.revisedRisk.L*r.revisedRisk.S}</strong> <RiskBadge rf={r.revisedRisk.L*r.revisedRisk.S} /></div>
                    </div>
                  </div>

                  {/* control measures */}
                  <div style={{ marginBottom:12 }}>
                    <label style={ss.lbl}>Control measures</label>
                    {r.controlMeasures.map((cm,i)=>(
                      <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"flex-start" }}>
                        <span style={{ fontSize:12, color:"var(--color-text-secondary)", paddingTop:9, minWidth:16, textAlign:"right" }}>{i+1}.</span>
                        <textarea value={cm} onChange={e=>updateControl(r.id,i,e.target.value)} rows={2}
                          style={{ ...ss.ta, flex:1, minHeight:40 }} />
                        <button onClick={()=>removeControl(r.id,i)} style={{ ...ss.btn, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595", flexShrink:0, marginTop:4 }}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>addControl(r.id)} style={{ ...ss.btn, fontSize:12, marginTop:4 }}>+ Add control measure</button>
                  </div>

                  {/* PPE */}
                  <div>
                    <label style={ss.lbl}>PPE required</label>
                    <input value={(r.ppeRequired||[]).join(", ")}
                      onChange={e=>updateRow(r.id,"ppeRequired",e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
                      placeholder="e.g. Hard hat, Safety glasses, Gloves" style={ss.inp} />
                    <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>Comma-separated list</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button onClick={onBack} style={ss.btn}>← Back</button>
        <button onClick={onNext} style={ss.btnP}>Next — preview & save →</button>
      </div>
    </div>
  );
}

// ─── Step 4 — Preview & save ─────────────────────────────────────────────────
function PreviewSave({ form, rows, workers, projects, onSave, onBack }) {
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const operatives = (form.operativeIds||[]).map(id=>workerMap[id]).filter(Boolean);

  const printRAMS = () => {
    const win = window.open("","_blank");
    const content = generatePrintHTML(form, rows, operatives, projectMap);
    win.document.write(content);
    win.document.close();
    win.print();
  };

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:20 }}>
        Review your completed RAMS before saving. You can print or export to PDF.
      </div>

      {/* preview card */}
      <div style={{ ...ss.card, marginBottom:20, border:"0.5px solid #9FE1CB" }}>
        {/* cover */}
        <div style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", paddingBottom:14, marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Location</div>
              <div style={{ fontWeight:500 }}>{form.location}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Job reference</div>
              <div style={{ fontWeight:500 }}>{form.jobRef||"—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Date</div>
              <div>{fmtDate(form.date)}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Lead engineer</div>
              <div>{form.leadEngineer||"—"}</div>
            </div>
          </div>
          <div style={{ background:"#f97316", borderRadius:6, padding:"8px 12px", color:"#fff", fontSize:14, fontWeight:500, textAlign:"center", marginBottom:8 }}>
            {form.title}
          </div>
          {form.scope && <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{form.scope}</div>}
        </div>

        {/* hazard summary */}
        <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:10 }}>
          {rows.length} risk assessment rows · {rows.filter(r=>getRiskLevel(r.initialRisk)==="high").length} high risk activities
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {rows.map((r,i)=>{
            const rl = getRiskLevel(r.revisedRisk);
            const c = RL[rl];
            return (
              <div key={r.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"6px 8px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6, fontSize:12 }}>
                <span style={{ color:"var(--color-text-secondary)", minWidth:20, textAlign:"right" }}>{i+1}</span>
                <span style={{ flex:1, fontWeight:500 }}>{r.activity}</span>
                <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, background:c.bg, color:c.color }}>RF {r.revisedRisk.L*r.revisedRisk.S}</span>
              </div>
            );
          })}
        </div>

        {/* operatives */}
        {operatives.length>0 && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>Operatives to sign:</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {operatives.map(n=>(
                <span key={n} style={{ padding:"2px 10px", borderRadius:20, fontSize:11, background:"#EAF3DE", color:"#27500A" }}>{n}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <button onClick={onBack} style={ss.btn}>← Back</button>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={printRAMS} style={ss.btn}>
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="1" width="10" height="10" rx="1"/><path d="M1 8h14v6H1z"/><path d="M5 14v-3h6v3"/><circle cx="12" cy="11" r=".5" fill="currentColor"/></svg>
            Print / PDF
          </button>
          <button onClick={onSave} style={ss.btnO}>
            Save RAMS
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Print HTML generator ────────────────────────────────────────────────────
function generatePrintHTML(form, rows, operatives, projectMap) {
  const rowsHTML = rows.map((r,i) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e5e5;font-weight:500;vertical-align:top;font-size:12px">${r.activity}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:top;font-size:12px">${r.hazard}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;vertical-align:top;font-size:12px;background:${RL[getRiskLevel(r.initialRisk)]?.bg}">${r.initialRisk.L}<br/>${r.initialRisk.S}<br/><strong>${r.initialRisk.L*r.initialRisk.S}</strong></td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:top;font-size:11px"><ol style="margin:0;padding-left:16px">${r.controlMeasures.map(cm=>`<li style="margin-bottom:4px">${cm}</li>`).join("")}</ol></td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;vertical-align:top;font-size:12px;background:${RL[getRiskLevel(r.revisedRisk)]?.bg}">${r.revisedRisk.L}<br/>${r.revisedRisk.S}<br/><strong>${r.revisedRisk.L*r.revisedRisk.S}</strong></td>
    </tr>`).join("");

  const sigRows = operatives.map(n => `
    <tr style="height:40px">
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:12px">${n}</td>
      <td style="border:1px solid #e5e5e5"></td>
      <td style="border:1px solid #e5e5e5"></td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${form.title}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:20px}
    h1{font-size:16px;font-weight:bold;text-align:center;background:#f97316;color:#fff;padding:10px;margin:0 0 16px}
    .header-table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .header-table td{padding:4px 8px;font-size:11px;border:0.5px solid #ccc}
    .header-table .lbl{color:#666;font-weight:bold}
    table.ra{width:100%;border-collapse:collapse;margin-bottom:20px}
    table.ra th{background:#0f172a;color:#fff;padding:8px;font-size:11px;text-align:left;border:1px solid #0f172a}
    @media print{body{padding:10px}h1{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <table class="header-table"><tr>
    <td><span class="lbl">Location:</span> ${form.location}</td>
    <td><span class="lbl">Job reference:</span> ${form.jobRef||"—"}</td>
    <td><span class="lbl">Date:</span> ${fmtDate(form.date)}</td>
    <td><span class="lbl">Lead engineer:</span> ${form.leadEngineer||"—"}</td>
  </tr></table>
  <h1>${form.title}</h1>
  ${form.scope?`<p style="font-size:12px;margin-bottom:16px">${form.scope}</p>`:""}
  <table class="ra">
    <thead><tr>
      <th style="width:18%">Activity</th>
      <th style="width:18%">Additional hazard</th>
      <th style="width:10%">Risk factor<br/>L / S / RF</th>
      <th style="width:40%">Control measures</th>
      <th style="width:10%">Revised RF<br/>L / S / RF</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <h2 style="font-size:13px;margin-bottom:8px">Operative signatures</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Name</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Signature</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Date</th>
    </tr></thead>
    <tbody>${sigRows}</tbody>
  </table>
  <p style="font-size:10px;color:#888;margin-top:20px">Generated by MySafeOps · REVISION ${form.revision||"1A"} · Review due: ${fmtDate(form.reviewDate)||"—"}</p>
  </body></html>`;
}

// ─── Saved RAMS list ─────────────────────────────────────────────────────────
function SavedList({ ramsDocs, workers, projects, onNew, onEdit, onDelete }) {
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{ramsDocs.length} RAMS document{ramsDocs.length!==1?"s":""}</div>
        <button onClick={onNew} style={ss.btnO}>+ Build new RAMS</button>
      </div>

      {ramsDocs.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No RAMS built yet. Create your first from the hazard library.</p>
          <button onClick={onNew} style={ss.btnO}>+ Build first RAMS</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {ramsDocs.map(doc=>(
            <div key={doc.id} style={{ ...ss.card, display:"flex", gap:12, alignItems:"center" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#5DCAA5"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--color-border-tertiary,#e5e5e5)"}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:500, fontSize:14, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.title}</div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12, color:"var(--color-text-secondary)" }}>
                  <span>{doc.location}</span>
                  {doc.jobRef && <span>Ref: {doc.jobRef}</span>}
                  <span>{doc.rows?.length||0} hazard rows</span>
                  <span>Created: {fmtDate(doc.createdAt)}</span>
                  {doc.reviewDate && <span style={{ color: new Date(doc.reviewDate)<new Date() ? "#A32D2D" : "inherit" }}>Review: {fmtDate(doc.reviewDate)}</span>}
                </div>
                {(doc.operativeIds||[]).length>0 && (
                  <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(doc.operativeIds||[]).map(id=>(
                      <span key={id} style={{ padding:"1px 8px", borderRadius:20, fontSize:10, background:"#EAF3DE", color:"#27500A" }}>{workerMap[id]||id}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500,
                  background:doc.status==="approved"?"#EAF3DE":doc.status==="draft"?"var(--color-background-secondary,#f7f7f5)":"#FAEEDA",
                  color:doc.status==="approved"?"#27500A":doc.status==="draft"?"var(--color-text-secondary)":"#633806" }}>
                  {doc.status||"draft"}
                </span>
                <button onClick={()=>onEdit(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Edit</button>
                <button onClick={()=>onDelete(doc.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function RAMSTemplateBuilder() {
  const [view, setView] = useState("list"); // list | builder
  const [step, setStep] = useState(1);
  const [ramsDocs, setRamsDocs] = useState(()=>load("rams_builder_docs",[]));
  const [workers] = useState(()=>load("mysafeops_workers",[]));
  const [projects] = useState(()=>load("mysafeops_projects",[]));
  const [editingDoc, setEditingDoc] = useState(null);

  // builder state
  const [form, setForm] = useState({});
  const [selectedHazards, setSelectedHazards] = useState([]);
  const [editedRows, setEditedRows] = useState([]);

  useEffect(()=>{ save("rams_builder_docs",ramsDocs); },[ramsDocs]);

  const startNew = () => {
    let formInit = { date: today(), revision: "1A" };
    let rowsInit = [];
    let selInit = [];
    let startStep = 1;
    try {
      const raw = sessionStorage.getItem("mysafeops_ai_rams_prefill");
      if (raw) {
        sessionStorage.removeItem("mysafeops_ai_rams_prefill");
        const d = JSON.parse(raw);
        formInit = {
          ...formInit,
          title: d.title || "",
          location: d.location || "",
          leadEngineer: d.leadEngineer || "",
          jobRef: d.jobRef || "",
        };
        (d.hazards || []).forEach((h) => {
          const id = genId();
          const sourceId = `ai_${id}`;
          rowsInit.push({
            id,
            sourceId,
            category: h.category || "General",
            activity: h.activity || "",
            hazard: h.hazard || "",
            initialRisk: h.initialRisk || { L: 3, S: 4, RF: 12 },
            revisedRisk: h.revisedRisk || { L: 2, S: 4, RF: 8 },
            controlMeasures: h.controlMeasures || [],
            ppeRequired: h.ppeRequired || [],
            regs: h.regs || [],
          });
          selInit.push({ id: sourceId });
        });
        if (rowsInit.length) startStep = 3;
      }
    } catch (e) {
      console.warn(e);
    }
    setForm(formInit);
    setSelectedHazards(selInit);
    setEditedRows(rowsInit);
    setStep(startStep);
    setEditingDoc(null);
    setView("builder");
  };

  const startEdit = (doc) => {
    setForm({...doc});
    setEditedRows(doc.rows||[]);
    setSelectedHazards((doc.rows||[]).map(r=>({ id:r.sourceId||r.id })));
    setEditingDoc(doc);
    setStep(3); // jump to editor
    setView("builder");
  };

  const toggleHazard = (h) => {
    setSelectedHazards(prev => {
      const exists = prev.some(s=>s.id===h.id);
      if (exists) {
        setEditedRows(rows => rows.filter(r=>(r.sourceId||r.id)!==h.id));
        return prev.filter(s=>s.id!==h.id);
      } else {
        // add to edited rows with copy of library data
        const newRow = { ...JSON.parse(JSON.stringify(h)), sourceId:h.id, id:genId() };
        setEditedRows(rows=>[...rows, newRow]);
        return [...prev, h];
      }
    });
  };

  const handleSave = () => {
    const doc = {
      ...form,
      id: editingDoc?.id || genId(),
      rows: editedRows,
      status: "draft",
      createdAt: editingDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRamsDocs(prev => editingDoc
      ? prev.map(d=>d.id===doc.id?doc:d)
      : [doc,...prev]
    );
    setView("list");
  };

  const deleteDoc = (id) => { if(confirm("Delete this RAMS?")) setRamsDocs(prev=>prev.filter(d=>d.id!==id)); };

  const STEPS = ["Document info","Select hazards","Review & edit","Preview & save"];

  if (view==="list") {
    return (
      <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:8 }}>
          <div>
            <h2 style={{ fontWeight:500, fontSize:20, margin:0 }}>RAMS builder</h2>
            <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"2px 0 0" }}>Build RAMS from hazard library — select, customise, print</p>
          </div>
        </div>
        <SavedList ramsDocs={ramsDocs} workers={workers} projects={projects} onNew={startNew} onEdit={startEdit} onDelete={deleteDoc} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={()=>setView("list")} style={{ ...ss.btn, fontSize:12 }}>← Back</button>
        <h2 style={{ fontWeight:500, fontSize:18, margin:0 }}>
          {editingDoc ? `Edit: ${form.title||"Untitled"}` : "New RAMS"}
        </h2>
      </div>

      {/* step progress */}
      <div style={{ display:"flex", gap:4, marginBottom:24 }}>
        {STEPS.map((s,i)=>(
          <div key={i} style={{ flex:1, textAlign:"center" }}>
            <div style={{ height:3, borderRadius:2, background:i<step-1?"#0d9488":i===step-1?"#f97316":"var(--color-border-tertiary,#e5e5e5)", marginBottom:6, transition:"background .3s" }} />
            <span style={{ fontSize:11, color:i===step-1?"#f97316":i<step-1?"#0d9488":"var(--color-text-secondary)", fontWeight:i===step-1?500:400 }}>
              {i+1}. {s}
            </span>
          </div>
        ))}
      </div>

      {/* steps */}
      {step===1 && <StepInfo form={form} setForm={setForm} projects={projects} workers={workers} onNext={()=>setStep(2)} />}
      {step===2 && <HazardPicker selected={selectedHazards} onToggle={toggleHazard} onNext={()=>setStep(3)} onBack={()=>setStep(1)} />}
      {step===3 && <HazardEditor rows={editedRows} setRows={setEditedRows} onNext={()=>setStep(4)} onBack={()=>setStep(2)} />}
      {step===4 && <PreviewSave form={form} rows={editedRows} workers={workers} projects={projects} onSave={handleSave} onBack={()=>setStep(3)} />}
    </div>
  );
}
