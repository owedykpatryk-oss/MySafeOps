import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { copyTextToClipboard } from "../utils/copyToClipboard";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { syncOrgSlugIfNeeded } from "../utils/orgMembership";
import { genPortalToken, publishPortalToCloud, fetchPublishedPortal, syncPortalCloudState, deletePortalFromCloud, defaultPortalExpiryIso } from "../utils/clientPortalCloud";
import { PORTAL_CLOUD_SYNC_EVENT } from "../utils/clientPortalAutoSync";
import { loadPublishedPortalTokens, markPortalPublished, unmarkPortalPublished } from "../utils/clientPortalPublished";
import { supabase as supabaseClient, isSupabaseConfigured } from "../lib/supabase";
import { ms } from "../utils/moduleStyles";
import { safeOpaqueToken } from "../utils/htmlEscape.js";
import { isFessOrg } from "../utils/fessOrg";
import { canUseFessExclusiveFeatures } from "../utils/fessExclusive";
import PageHero from "./PageHero";

const genRowId = () => `portal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };
const fmtDateTime = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); };
const daysUntil = (iso) => { if (!iso) return null; return Math.ceil((new Date(iso)-new Date())/(1000*60*60*24)); };

const ss = {
  ...ms,
  btn: { ...ms.btn, display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { ...ms.btnP, display:"inline-flex", alignItems:"center", gap:6 },
};

// ─── Client Portal VIEW (what the client sees) ────────────────────────────────
function isPortalAccessible(portal) {
  if (!portal || portal.active === false) return false;
  if (portal.expiresAt && new Date(portal.expiresAt) < new Date()) return false;
  return true;
}

function PortalView({ token, portals, cloudBundle }) {
  const portal = cloudBundle?.portal ?? portals.find((p) => p.token === token);
  const snapshot = cloudBundle?.snapshot;
  const readOnlyCloud = Boolean(cloudBundle);
  const [ramsDocs, setRamsDocs] = useState(() => snapshot?.rams ?? load("rams_builder_docs", []));
  const [approvingId, setApprovingId] = useState(null);
  const [approveForm, setApproveForm] = useState({ by: "", notes: "" });

  if (!isPortalAccessible(portal)) {
    return (
      <div style={{ fontFamily:"DM Sans,sans-serif", padding:"3rem 1rem", textAlign:"center" }}>
        <div style={{ fontSize:14, color:"var(--color-text-secondary)" }}>Invalid or expired portal link.</div>
      </div>
    );
  }

  const workers = snapshot?.workers ?? load("mysafeops_workers",[]);
  const permits = snapshot?.permits ?? load("permits_v2",[]);
  const incidents = snapshot?.incidents ?? load("mysafeops_incidents",[]);
  const snags = snapshot?.snags ?? load("snags",[]);
  const now = new Date();

  const saveRamsApproval = (ramsId) => {
    if (readOnlyCloud) {
      window.alert("RAMS approval from a published cloud link is read-only. Ask your contractor to record approval in the workspace.");
      return;
    }
    const by = String(approveForm.by || portal.clientName || "").trim();
    if (!by) {
      window.alert("Enter your name to approve this RAMS.");
      return;
    }
    const signDate = new Date().toISOString().slice(0, 10);
    const next = ramsDocs.map((r) =>
      r.id === ramsId
        ? {
            ...r,
            clientApproval: {
              by,
              at: new Date().toISOString(),
              notes: String(approveForm.notes || "").trim(),
              portalToken: token,
            },
            ...(canUseFessExclusiveFeatures()
              ? {
                  permitControllerName: String(r.permitControllerName || by).trim() || by,
                  permitControllerSignDate: r.permitControllerSignDate || signDate,
                }
              : {}),
          }
        : r
    );
    setRamsDocs(next);
    save("rams_builder_docs", next);
    setApprovingId(null);
    setApproveForm({ by: "", notes: "" });
  };

  // filter to project if scoped
  const filteredWorkers = portal.projectId ? workers.filter(w=>(w.projectIds||[]).includes(portal.projectId)) : workers;
  const filteredRAMS = portal.projectId ? ramsDocs.filter(r=>r.projectId===portal.projectId) : ramsDocs;
  const filteredPermits = portal.projectId ? permits.filter(p=>p.projectId===portal.projectId) : permits;
  const filteredSnags = portal.projectId ? snags.filter(s=>s.projectId===portal.projectId) : snags;
  const filteredIncidents = portal.projectId ? incidents.filter((i) => i.projectId === portal.projectId) : incidents;

  const expiredCerts = filteredWorkers.flatMap(w=>(w.certifications||[]).filter(c=>c.expiryDate&&new Date(c.expiryDate)<now).map(c=>({...c,workerName:w.name})));
  const unsignedRAMS = filteredRAMS.filter(r=>!r.signed&&r.status!=="draft"&&!r.clientApproval?.at);
  const activePermits = filteredPermits.filter(p=>p.status==="active");
  const openSnags = filteredSnags.filter(s=>s.status==="open");

  const complianceScore = Math.max(0, 100 - expiredCerts.length*5 - unsignedRAMS.length*5);
  const scoreColor = complianceScore>=80?"#27500A":complianceScore>=60?"#633806":"#791F1F";
  const scoreBg = complianceScore>=80?"#EAF3DE":complianceScore>=60?"#FAEEDA":"#FCEBEB";

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", minHeight:"100vh", background:"var(--color-background-tertiary,#f7f7f5)" }}>
      {/* Neutral client-facing header — contractor logo stays on internal PDFs only */}
      <div style={{ background:"#0f172a", padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color:"#fff", fontWeight:500, fontSize:15 }}>{portal.clientName}</div>
          <div style={{ color:"#94a3b8", fontSize:12 }}>{portal.projectName||"All projects"} · Read-only compliance view</div>
        </div>
        <div style={{ marginLeft:"auto", fontSize:11, color:"#64748b", flexShrink: 0 }}>
          {readOnlyCloud ? "Cloud snapshot · " : ""}Updated: {fmtDateTime(snapshot?.publishedAt || new Date().toISOString())}
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
                <div key={r.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", fontSize:13, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontWeight:500 }}>{r.title}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{fmtDate(r.date)}{r.reviewDate?` · Review: ${fmtDate(r.reviewDate)}`:""}</div>
                    {r.clientApproval?.at ? (
                      <div style={{ fontSize:11, color:"#27500A", marginTop:4 }}>Client approved by {r.clientApproval.by} · {fmtDateTime(r.clientApproval.at)}</div>
                    ) : null}
                  </div>
                  <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500,
                    background:r.clientApproval?.at?"#EAF3DE":r.signed?"#EAF3DE":r.status==="draft"?"var(--color-background-secondary,#f7f7f5)":"#FAEEDA",
                    color:r.clientApproval?.at?"#27500A":r.signed?"#27500A":r.status==="draft"?"var(--color-text-secondary)":"#633806" }}>
                    {r.clientApproval?.at?"Client approved":r.signed?"Signed":r.status||"draft"}
                  </span>
                  {!readOnlyCloud && !r.clientApproval?.at && r.status!=="draft" && portal.allowRamsApproval !== false ? (
                    <button
                      type="button"
                      style={{ ...ss.btnP, fontSize:11, padding:"4px 10px" }}
                      onClick={() => {
                        setApprovingId(r.id);
                        setApproveForm({ by: portal.clientName || "", notes: "" });
                      }}
                    >
                      Approve RAMS
                    </button>
                  ) : null}
                </div>
              ))
            }
            {approvingId ? (
              <div style={{ marginTop:12, padding:12, background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                <div style={{ fontWeight:500, fontSize:13, marginBottom:8 }}>Client RAMS approval</div>
                <label style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Your name</label>
                <input style={{ ...ss.inp, marginBottom:8 }} value={approveForm.by} onChange={(e)=>setApproveForm(f=>({...f,by:e.target.value}))} />
                <label style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Notes (optional)</label>
                <textarea style={{ ...ss.inp, minHeight:50, marginBottom:8 }} value={approveForm.notes} onChange={(e)=>setApproveForm(f=>({...f,notes:e.target.value}))} placeholder="Conditions or comments" />
                <div style={{ display:"flex", gap:8 }}>
                  <button type="button" style={ss.btn} onClick={()=>setApprovingId(null)}>Cancel</button>
                  <button type="button" style={ss.btnP} onClick={()=>saveRamsApproval(approvingId)}>Confirm approval</button>
                </div>
              </div>
            ) : null}
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
          Read-only client view · Neutral portal branding (your contractor logo appears on issued RAMS PDFs, not here) · {fmtDateTime(new Date().toISOString())}
        </div>
      </div>
    </div>
  );
}

// ─── Portal manager (internal) ────────────────────────────────────────────────
export default function ClientPortal() {
  const { caps } = useApp();
  const { pushToast } = useToast();
  const { user, supabase } = useSupabaseAuth();
  const cloudReady = Boolean(user && supabase && isSupabaseConfigured());
  const [portals, setPortals] = useState(()=>load("client_portals",[]));
  const [modal, setModal] = useState(null);
  const [previewToken, setPreviewToken] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [publishedTokens, setPublishedTokens] = useState(() => loadPublishedPortalTokens());
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState(null);
  const projects = load("mysafeops_projects",[]);

  useEffect(() => {
    const onSync = (event) => {
      setLastCloudSyncAt(event?.detail?.at || new Date().toISOString());
    };
    window.addEventListener(PORTAL_CLOUD_SYNC_EVENT, onSync);
    return () => window.removeEventListener(PORTAL_CLOUD_SYNC_EVENT, onSync);
  }, []);

  useEffect(()=>{ save("client_portals",portals); },[portals]);

  const [newPortal, setNewPortal] = useState({ clientName:"", projectId:"", sections:["workers","rams","permits","snags"], expiresAt:"" });
  const [showCreate, setShowCreate] = useState(false);

  const SECTIONS = [["workers","Worker competency & certs"],["rams","RAMS documents"],["permits","Permits to work"],["snags","Snagging register"],["incidents","Incident log"]];

  const createPortal = () => {
    if (!newPortal.clientName.trim()) return;
    const expiresAt = newPortal.expiresAt || defaultPortalExpiryIso();
    const p = {
      ...newPortal,
      expiresAt,
      id: genRowId(),
      token: genPortalToken(),
      projectName: projects.find(p=>p.id===newPortal.projectId)?.name||"All projects",
      createdAt: new Date().toISOString(),
      active: true,
    };
    setPortals(prev=>[p,...prev]);
    setShowCreate(false);
    setNewPortal({ clientName:"", projectId:"", sections:["workers","rams","permits","snags"], expiresAt:"" });
    if (cloudReady) {
      pushToast({ type: "info", message: "Portal created — click Publish cloud so your client can open the link on any device." });
    }
  };

  const publishPortal = async (portalRow) => {
    if (!supabase || !user) {
      pushToast({ type: "warn", message: "Sign in to publish portal links for clients on any device." });
      return;
    }
    setPublishingId(portalRow.id);
    try {
      const orgSlug = await syncOrgSlugIfNeeded(supabase);
      await publishPortalToCloud(supabase, portalRow, orgSlug);
      markPortalPublished(portalRow.token);
      setPublishedTokens((prev) => new Set(prev).add(portalRow.token));
      setLastCloudSyncAt(new Date().toISOString());
      pushToast({ type: "success", message: "Portal published — link works on any device for your client." });
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Could not publish portal to cloud." });
    } finally {
      setPublishingId(null);
    }
  };

  const togglePortalActive = async (portalRow) => {
    const next = { ...portalRow, active: !portalRow.active };
    setPortals((prev) => prev.map((x) => (x.id === portalRow.id ? next : x)));
    if (!cloudReady || !publishedTokens.has(portalRow.token)) return;
    setPublishingId(portalRow.id);
    try {
      const orgSlug = await syncOrgSlugIfNeeded(supabase);
      await syncPortalCloudState(supabase, next, orgSlug);
      pushToast({
        type: next.active ? "success" : "warn",
        message: next.active ? "Portal re-activated in cloud." : "Portal deactivated — cloud link revoked.",
      });
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Could not sync portal status to cloud." });
    } finally {
      setPublishingId(null);
    }
  };

  const removePortal = async (portalRow) => {
    if (!window.confirm("Delete portal?")) return;
    setPortals((prev) => prev.filter((x) => x.id !== portalRow.id));
    if (cloudReady && publishedTokens.has(portalRow.token)) {
      try {
        await deletePortalFromCloud(supabase, portalRow.token);
        unmarkPortalPublished(portalRow.token);
        setPublishedTokens((prev) => {
          const s = new Set(prev);
          s.delete(portalRow.token);
          return s;
        });
      } catch {
        pushToast({ type: "warn", message: "Portal removed locally; cloud copy may still exist until you delete it in Supabase." });
      }
    }
  };

  const copyPortalLink = async (url) => {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      pushToast({ type: "success", message: "Portal link copied to clipboard." });
    } else {
      pushToast({ type: "error", message: "Could not copy — select the link and copy manually." });
    }
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
        lead="Share read-only compliance view with your clients — no login needed. Client links use neutral branding; your company logo stays on RAMS PDFs for your team."
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
                      {publishedTokens.has(p.token) ? (
                        <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#E6F1FB", color:"#0C447C" }}>Cloud</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      Scope: {p.projectName||"All projects"} · Sections: {(p.sections||[]).join(", ")} · Created: {fmtDate(p.createdAt)}
                      {p.expiresAt&&` · Expires: ${fmtDate(p.expiresAt)}`}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={()=>setPreviewToken(p.token)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Preview</button>
                    <button onClick={() => void copyPortalLink(portalUrl)} style={{ ...ss.btnP, fontSize:12, padding:"4px 10px" }}>Copy link</button>
                    {cloudReady && caps.clientPortalManage ? (
                      <button
                        type="button"
                        disabled={publishingId === p.id || !p.active || expired}
                        onClick={() => void publishPortal(p)}
                        style={{ ...ss.btn, fontSize:12, padding:"4px 10px", borderColor:"#9FE1CB", color:"#0f766e" }}
                        title="Publish snapshot to cloud so clients can open the link on any device"
                      >
                        {publishingId === p.id ? "Publishing…" : publishedTokens.has(p.token) ? "Re-publish" : "Publish cloud"}
                      </button>
                    ) : null}
                    {caps.clientPortalManage && (
                      <>
                        <button type="button" onClick={() => void togglePortalActive(p)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>{p.active?"Deactivate":"Activate"}</button>
                        <button type="button" onClick={() => void removePortal(p)}
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
        Client portal links are read-only for compliance viewing. Use <strong>Publish cloud</strong> (when signed in) so clients can open the link on any device. Deactivate a link to revoke access. Same-browser preview works without cloud.
        {cloudReady && publishedTokens.size > 0 ? (
          <div style={{ marginTop: 8, fontSize: 11, color: "#0f766e" }}>
            {publishingId ? "Syncing cloud snapshot…" : lastCloudSyncAt ? `Last cloud sync: ${fmtDateTime(lastCloudSyncAt)} · auto-updates when you save compliance data` : "Cloud published — auto-updates when you save compliance data"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Public read-only view when opened with ?portal=token */
export function PublicClientPortalView({ token }) {
  const safeToken = safeOpaqueToken(token);
  const [cloudBundle, setCloudBundle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!safeToken) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      if (supabaseClient) {
        try {
          const data = await fetchPublishedPortal(supabaseClient, safeToken);
          if (!cancelled && data) {
            setCloudBundle(data);
            setLoading(false);
            return;
          }
        } catch {
          /* fall through to local */
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [safeToken]);

  if (!safeToken) {
    return (
      <div style={{ fontFamily: "DM Sans,sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Invalid or expired portal link.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "DM Sans,sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Loading client portal…</div>
      </div>
    );
  }

  if (cloudBundle) {
    return <PortalView token={safeToken} portals={[]} cloudBundle={cloudBundle} />;
  }

  const portals = load("client_portals", []);
  return <PortalView token={safeToken} portals={portals} />;
}
