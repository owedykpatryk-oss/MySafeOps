import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const genId = () => `portal_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };
const fmtDateTime = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); };
const daysUntil = (iso) => { if (!iso) return null; return Math.ceil((new Date(iso)-new Date())/(1000*60*60*24)); };

const ss = {
  ...ms,
  btn: { ...ms.btn, display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { ...ms.btnP, display:"inline-flex", alignItems:"center", gap:6 },
};

// ─── Client Portal VIEW (what the client sees) ────────────────────────────────
function PortalView({ token, portals }) {
  const portal = portals.find(p=>p.token===token);
  if (!portal) return (
    <div style={{ fontFamily:"DM Sans,sans-serif", padding:"3rem 1rem", textAlign:"center" }}>
      <div style={{ fontSize:14, color:"var(--color-text-secondary)" }}>Invalid or expired portal link.</div>
    </div>
  );

  const workers = load("mysafeops_workers",[]);
  const rams = load("rams_builder_docs",[]);
  const permits = load("permits_v2",[]);
  const incidents = load("mysafeops_incidents",[]);
  const snags = load("snags",[]);
  const now = new Date();

  // filter to project if scoped
  const filteredWorkers = portal.projectId ? workers.filter(w=>(w.projectIds||[]).includes(portal.projectId)) : workers;
  const filteredRAMS = portal.projectId ? rams.filter(r=>r.projectId===portal.projectId) : rams;
  const filteredPermits = portal.projectId ? permits.filter(p=>p.projectId===portal.projectId) : permits;
  const filteredSnags = portal.projectId ? snags.filter(s=>s.projectId===portal.projectId) : snags;
  const filteredIncidents = portal.projectId ? incidents.filter((i) => i.projectId === portal.projectId) : incidents;

  const expiredCerts = filteredWorkers.flatMap(w=>(w.certifications||[]).filter(c=>c.expiryDate&&new Date(c.expiryDate)<now).map(c=>({...c,workerName:w.name})));
  const unsignedRAMS = filteredRAMS.filter(r=>!r.signed&&r.status!=="draft");
  const activePermits = filteredPermits.filter(p=>p.status==="active");
  const openSnags = filteredSnags.filter(s=>s.status==="open");

  const complianceScore = Math.max(0, 100 - expiredCerts.length*5 - unsignedRAMS.length*5);
  const scoreColor = complianceScore>=80?"#27500A":complianceScore>=60?"#633806":"#791F1F";
  const scoreBg = complianceScore>=80?"#EAF3DE":complianceScore>=60?"#FAEEDA":"#FCEBEB";

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", minHeight:"100vh", background:"var(--color-background-tertiary,#f7f7f5)" }}>
      {/* header */}
      <div style={{ background:"#0f172a", padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:36, height:36, borderRadius:8, background:"#0d9488", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#E1F5EE" strokeWidth={2}><path d="M12 2L3 7v9c0 4 3 6 9 7 6-1 9-3 9-7V7L12 2z"/></svg>
        </div>
        <div>
          <div style={{ color:"#fff", fontWeight:500, fontSize:15 }}>{portal.clientName} — Project compliance portal</div>
          <div style={{ color:"#94a3b8", fontSize:12 }}>MySafeOps · {portal.projectName||"All projects"} · Read-only</div>
        </div>
        <div style={{ marginLeft:"auto", fontSize:11, color:"#64748b" }}>
          Updated: {fmtDateTime(new Date().toISOString())}
        </div>
      </div>

      <div style={{ padding:"1.5rem", maxWidth:900, margin:"0 auto" }}>
        {/* score cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:24 }}>
          {[
            { label:"Compliance score", value:`${complianceScore}`, unit:"/100", bg:scoreBg, color:scoreColor },
            { label:"Workers on project", value:filteredWorkers.length, unit:"", bg:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)" },
            { label:"Active permits", value:activePermits.length, unit:"", bg:"#EAF3DE", color:"#27500A" },
            { label:"RAMS documents", value:filteredRAMS.length, unit:"", bg:"#E6F1FB", color:"#0C447C" },
            { label:"Open snags", value:openSnags.length, unit:"", bg:openSnags.length>0?"#FAEEDA":"#EAF3DE", color:openSnags.length>0?"#633806":"#27500A" },
            { label:"Expired certs", value:expiredCerts.length, unit:"", bg:expiredCerts.length>0?"#FCEBEB":"#EAF3DE", color:expiredCerts.length>0?"#791F1F":"#27500A" },
          ].map(c=>(
            <div key={c.label} style={{ background:c.bg, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:26, fontWeight:500, color:c.color }}>{c.value}<span style={{ fontSize:14 }}>{c.unit}</span></div>
            </div>
          ))}
        </div>

        {/* permitted sections based on portal.sections */}
        {portal.sections?.includes("workers") && (
          <div style={{ ...ss.card, marginBottom:16 }}>
            <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>Worker competency — {filteredWorkers.length} workers</div>
            {filteredWorkers.length===0 ? <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>No workers.</div> :
              filteredWorkers.map(w=>{
                const certs = w.certifications||[];
                const expiredCount = certs.filter(c=>c.expiryDate&&new Date(c.expiryDate)<now).length;
                const expiringCount = certs.filter(c=>{ const d=daysUntil(c.expiryDate); return d!==null&&d>=0&&d<=30; }).length;
                return (
                  <div key={w.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"#E1F5EE", color:"#085041", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500 }}>
                      {(w.name||"?").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:500, fontSize:13 }}>{w.name}</div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{w.role||"—"} · {certs.length} certs</div>
                    </div>
                    {expiredCount>0 && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#FCEBEB", color:"#791F1F" }}>{expiredCount} expired</span>}
                    {expiringCount>0 && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#FAEEDA", color:"#633806" }}>{expiringCount} expiring soon</span>}
                    {expiredCount===0&&expiringCount===0&&certs.length>0 && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#EAF3DE", color:"#27500A" }}>All current</span>}
                  </div>
                );
              })
            }
          </div>
        )}

        {portal.sections?.includes("rams") && (
          <div style={{ ...ss.card, marginBottom:16 }}>
            <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>RAMS documents — {filteredRAMS.length}</div>
            {filteredRAMS.length===0 ? <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>No RAMS.</div> :
              filteredRAMS.map(r=>(
                <div key={r.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500 }}>{r.title}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{fmtDate(r.date)}{r.reviewDate?` · Review: ${fmtDate(r.reviewDate)}`:""}</div>
                  </div>
                  <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500,
                    background:r.signed?"#EAF3DE":r.status==="draft"?"var(--color-background-secondary,#f7f7f5)":"#FAEEDA",
                    color:r.signed?"#27500A":r.status==="draft"?"var(--color-text-secondary)":"#633806" }}>
                    {r.signed?"Signed":r.status||"draft"}
                  </span>
                </div>
              ))
            }
          </div>
        )}

        {portal.sections?.includes("permits") && (
          <div style={{ ...ss.card, marginBottom:16 }}>
            <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>Permits to work — {filteredPermits.length}</div>
            {filteredPermits.length===0 ? <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>No permits.</div> :
              filteredPermits.map(p=>(
                <div key={p.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500 }}>{p.type||"Permit"}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{p.location||"—"} · Issued: {fmtDate(p.issuedDate)}</div>
                  </div>
                  <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500,
                    background:p.status==="active"?"#EAF3DE":p.status==="expired"?"#FCEBEB":"#FAEEDA",
                    color:p.status==="active"?"#27500A":p.status==="expired"?"#791F1F":"#633806" }}>
                    {p.status||"pending"}
                  </span>
                </div>
              ))
            }
          </div>
        )}

        {portal.sections?.includes("snags") && openSnags.length>0 && (
          <div style={{ ...ss.card, marginBottom:16 }}>
            <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>Open snags — {openSnags.length}</div>
            {openSnags.map(s=>(
              <div key={s.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{s.ref||""} {s.title}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{s.category||""}{s.location?` · ${s.location}`:""}</div>
                </div>
                <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11,
                  background:s.priority==="high"?"#FCEBEB":"#FAEEDA",
                  color:s.priority==="high"?"#791F1F":"#633806" }}>{s.priority}</span>
              </div>
            ))}
          </div>
        )}

        {portal.sections?.includes("incidents") && (
          <div style={{ ...ss.card, marginBottom:16 }}>
            <div style={{ fontWeight:500, fontSize:14, marginBottom:12 }}>Incidents & near misses — {filteredIncidents.length}</div>
            {filteredIncidents.length===0 ? <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>No incident or near-miss records in scope.</div> :
              [...filteredIncidents].sort((a,b)=>new Date(b.occurredAt||b.createdAt||0)-new Date(a.occurredAt||a.createdAt||0)).slice(0,80).map(i=>(
                <div key={i.id} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500 }}>{i.type==="near_miss"?"Near miss":"Incident"}{i.injuryInvolved?" · Injury noted":""}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{fmtDate(i.occurredAt||i.createdAt)}{i.location?` · ${i.location}`:""}{i.projectName?` · ${i.projectName}`:""}</div>
                    {i.description && <div style={{ fontSize:12, marginTop:4, color:"var(--color-text-primary)" }}>{String(i.description).slice(0,200)}{String(i.description).length>200?"…":""}</div>}
                  </div>
                  <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, flexShrink:0,
                    background:i.status==="closed"?"#EAF3DE":i.severity==="critical"||i.severity==="high"?"#FCEBEB":"#FAEEDA",
                    color:i.status==="closed"?"#27500A":i.severity==="critical"||i.severity==="high"?"#791F1F":"#633806" }}>
                    {i.status||"open"}
                  </span>
                </div>
              ))
            }
          </div>
        )}

        <div style={{ textAlign:"center", fontSize:11, color:"var(--color-text-secondary)", marginTop:24, paddingTop:16, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          Read-only client view · Generated by MySafeOps · {fmtDateTime(new Date().toISOString())}
        </div>
      </div>
    </div>
  );
}

// ─── Portal manager (internal) ────────────────────────────────────────────────
export default function ClientPortal() {
  const { caps } = useApp();
  const [portals, setPortals] = useState(()=>load("client_portals",[]));
  const [modal, setModal] = useState(null);
  const [previewToken, setPreviewToken] = useState(null);
  const projects = load("mysafeops_projects",[]);

  useEffect(()=>{ save("client_portals",portals); },[portals]);

  const [newPortal, setNewPortal] = useState({ clientName:"", projectId:"", sections:["workers","rams","permits","snags"], expiresAt:"" });
  const [showCreate, setShowCreate] = useState(false);

  const SECTIONS = [["workers","Worker competency & certs"],["rams","RAMS documents"],["permits","Permits to work"],["snags","Snagging register"],["incidents","Incident log"]];

  const createPortal = () => {
    if (!newPortal.clientName.trim()) return;
    const p = {
      ...newPortal,
      id: genId(),
      token: genId(),
      projectName: projects.find(p=>p.id===newPortal.projectId)?.name||"All projects",
      createdAt: new Date().toISOString(),
      active: true,
    };
    setPortals(prev=>[p,...prev]);
    setShowCreate(false);
    setNewPortal({ clientName:"", projectId:"", sections:["workers","rams","permits","snags"], expiresAt:"" });
  };

  if (previewToken) return (
    <div>
      <div style={{ padding:"10px 16px", background:"#FAEEDA", borderBottom:"0.5px solid #FAC775", display:"flex", gap:10, alignItems:"center", fontFamily:"DM Sans,sans-serif", fontSize:13 }}>
        <span style={{ color:"#633806" }}>Preview mode — this is what your client sees at the portal link</span>
        <button onClick={()=>setPreviewToken(null)} style={{ marginLeft:"auto", padding:"4px 10px", borderRadius:6, border:"0.5px solid #FAC775", background:"#fff", cursor:"pointer", fontSize:12, fontFamily:"DM Sans,sans-serif" }}>Exit preview</button>
      </div>
      <PortalView token={previewToken} portals={portals} />
    </div>
  );

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      <PageHero
        badgeText="CL"
        title="Client portal"
        lead="Share read-only compliance view with your clients — no login needed."
        right={
          caps.clientPortalManage ? (
            <button type="button" onClick={() => setShowCreate(true)} style={ss.btnP}>
              + Create portal link
            </button>
          ) : null
        }
      />

      {showCreate && (
        <div style={{ ...ss.card, marginBottom:20, border:"0.5px solid #9FE1CB" }}>
          <div style={{ fontWeight:500, fontSize:14, marginBottom:14 }}>New client portal</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))", gap:10, marginBottom:12 }}>
            <div>
              <label style={ss.lbl}>Client name *</label>
              <input value={newPortal.clientName} onChange={e=>setNewPortal(n=>({...n,clientName:e.target.value}))} placeholder="e.g. Two Sisters Food Group" style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Scope (project)</label>
              <select value={newPortal.projectId} onChange={e=>setNewPortal(n=>({...n,projectId:e.target.value}))} style={ss.inp}>
                <option value="">All projects</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={ss.lbl}>Expires (optional)</label>
              <input type="date" value={newPortal.expiresAt||""} onChange={e=>setNewPortal(n=>({...n,expiresAt:e.target.value}))} style={ss.inp} />
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={ss.lbl}>Sections to show</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {SECTIONS.map(([k,l])=>{
                const sel=newPortal.sections.includes(k);
                return (
                  <button key={k} type="button" onClick={()=>setNewPortal(n=>({...n,sections:sel?n.sections.filter(s=>s!==k):[...n.sections,k]}))}
                    style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                      background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)",
                      color:sel?"#E1F5EE":"var(--color-text-primary)",
                      border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)" }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowCreate(false)} style={ss.btn}>Cancel</button>
            <button disabled={!newPortal.clientName.trim()} onClick={createPortal} style={{ ...ss.btnP, opacity:newPortal.clientName.trim()?1:0.4 }}>Generate portal link</button>
          </div>
        </div>
      )}

      {portals.length===0 && !showCreate ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No client portals yet. Create a link to share your compliance status with a client.</p>
          {caps.clientPortalManage && <button onClick={()=>setShowCreate(true)} style={ss.btnP}>+ Create first portal</button>}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {portals.map(p=>{
            const portalUrl = `${window.location.origin}${window.location.pathname}?portal=${p.token}`;
            const expired = p.expiresAt && new Date(p.expiresAt)<new Date();
            return (
              <div key={p.id} style={{ ...ss.card }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:500, fontSize:14 }}>{p.clientName}</span>
                      <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500,
                        background:expired?"#FCEBEB":p.active?"#EAF3DE":"var(--color-background-secondary,#f7f7f5)",
                        color:expired?"#791F1F":p.active?"#27500A":"var(--color-text-secondary)" }}>
                        {expired?"Expired":p.active?"Active":"Inactive"}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      Scope: {p.projectName||"All projects"} · Sections: {(p.sections||[]).join(", ")} · Created: {fmtDate(p.createdAt)}
                      {p.expiresAt&&` · Expires: ${fmtDate(p.expiresAt)}`}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={()=>setPreviewToken(p.token)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Preview</button>
                    <button onClick={()=>navigator.clipboard?.writeText(portalUrl).then(()=>alert("Link copied!"))} style={{ ...ss.btnP, fontSize:12, padding:"4px 10px" }}>Copy link</button>
                    {caps.clientPortalManage && (
                      <>
                        <button onClick={()=>setPortals(prev=>prev.map(x=>x.id===p.id?{...x,active:!x.active}:x))}
                          style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>{p.active?"Deactivate":"Activate"}</button>
                        <button onClick={()=>{ if(confirm("Delete portal?")) setPortals(prev=>prev.filter(x=>x.id!==p.id)); }}
                          style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6, fontSize:11, color:"var(--color-text-secondary)" }}>
                  <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M10 3H13v3M13 3l-6 6M6 5H3v8h8v-3"/></svg>
                  <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{portalUrl}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop:24, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Client portal links are read-only — clients cannot edit any data. Each link can be scoped to a specific project and set of sections. Deactivate a link at any time to revoke access.
      </div>
    </div>
  );
}

/** Public read-only view when opened with ?portal=token (same device / org data). */
export function PublicClientPortalView({ token }) {
  const portals = load("client_portals", []);
  return <PortalView token={token} portals={portals} />;
}
