import { useState, useRef, useEffect, useCallback } from "react";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const loadJSON = (k, fallback = []) => loadOrgScoped(k, fallback);
const saveJSON = (k, v) => saveOrgScoped(k, v);
const genId = () => `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
};

const ss = { ...ms, btnPrimary: ms.btnP, label: ms.lbl, input: ms.inp };

function SignatureCanvas({ onCapture, label = "Draw signature here" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [hasContent, setHasContent] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) return { x:(e.touches[0].clientX - rect.left)*scaleX, y:(e.touches[0].clientY - rect.top)*scaleY };
    return { x:(e.clientX - rect.left)*scaleX, y:(e.clientY - rect.top)*scaleY };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    drawing.current = true;
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 1, 0, Math.PI*2);
    ctx.fillStyle = "#0f172a"; ctx.fill();
    setHasContent(true);
  }, []);

  const draw = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.5;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    lastPos.current = pos;
  }, []);

  const stopDraw = useCallback(() => { drawing.current = false; }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener("touchstart", startDraw, { passive:false });
    canvas.addEventListener("touchmove", draw, { passive:false });
    canvas.addEventListener("touchend", stopDraw);
    return () => {
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  return (
    <div>
      <div style={{ position:"relative", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:8, background:"#fff", overflow:"hidden" }}>
        <canvas ref={canvasRef} width={600} height={180}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          style={{ width:"100%", height:140, display:"block", cursor:"crosshair", touchAction:"none" }}
        />
        {!hasContent && (
          <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <span style={{ fontSize:13, color:"#ccc", fontStyle:"italic" }}>{label}</span>
          </div>
        )}
        <div style={{ position:"absolute", bottom:6, left:10, right:10, borderTop:"1px solid #e5e5e5", pointerEvents:"none" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, alignItems:"center" }}>
        <button onClick={clear} style={{ ...ss.btn, fontSize:12 }}>Clear</button>
        <button onClick={() => hasContent && onCapture(canvasRef.current.toDataURL("image/png"))}
          disabled={!hasContent}
          style={{ ...ss.btnPrimary, opacity:hasContent?1:0.4, fontSize:12 }}>
          Confirm signature
        </button>
      </div>
    </div>
  );
}

const getGPS = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat:pos.coords.latitude.toFixed(6), lng:pos.coords.longitude.toFixed(6), accuracy:Math.round(pos.coords.accuracy) }),
    () => resolve(null),
    { timeout:6000 }
  );
});

function Row({ label, value }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:4, fontSize:12 }}>
      <span style={{ color:"var(--color-text-secondary)", minWidth:70 }}>{label}</span>
      <span style={{ color:"var(--color-text-primary)", wordBreak:"break-all" }}>{value}</span>
    </div>
  );
}

function SignatureBlock({ signer, docId, signatures, onSign, onClear }) {
  const [signing, setSigning] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle");
  const existing = signatures.find(s => s.signerId === signer.id && s.docId === docId);

  const handleCapture = async (dataUrl) => {
    setGpsStatus("fetching");
    const gps = await getGPS();
    setGpsStatus(gps ? "ok" : "denied");
    onSign({
      id:genId(), docId, signerId:signer.id,
      signerName:signer.name, signerRole:signer.role || "Operative",
      dataUrl, timestamp:new Date().toISOString(), gps,
      device: navigator.userAgent.split("(")[1]?.split(")")[0] || "Unknown",
    });
    setSigning(false); setGpsStatus("idle");
  };

  const initials = (n) => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:10, padding:"1rem", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#E1F5EE", color:"#085041", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:500 }}>
            {initials(signer.name)}
          </div>
          <div>
            <div style={{ fontWeight:500, fontSize:14 }}>{signer.name || "Unnamed"}</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{signer.role || "Operative"}</div>
          </div>
        </div>
        {existing ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:"#EAF3DE", color:"#27500A" }}>Signed</span>
            <button onClick={()=>onClear(existing.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>Remove</button>
          </div>
        ) : (
          <button onClick={()=>setSigning(v=>!v)} style={ss.btnPrimary}>{signing?"Cancel":"Sign"}</button>
        )}
      </div>

      {existing && (
        <div style={{ background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, padding:"10px 12px", display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
          <img src={existing.dataUrl} alt="signature" style={{ height:56, maxWidth:180, objectFit:"contain", border:"0.5px solid #e5e5e5", borderRadius:4, background:"#fff" }} />
          <div style={{ flex:1, minWidth:160 }}>
            <Row label="Signed at" value={fmtDateTime(existing.timestamp)} />
            <Row label="Location" value={existing.gps ? `${existing.gps.lat}, ${existing.gps.lng} (±${existing.gps.accuracy}m)` : "GPS not available"} />
            <Row label="Device" value={(existing.device||"—").slice(0,60)} />
          </div>
        </div>
      )}

      {signing && !existing && (
        <div style={{ marginTop:10 }}>
          {gpsStatus==="fetching" && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>Getting GPS location…</div>}
          <SignatureCanvas onCapture={handleCapture} label={`${signer.name || "Sign"} — draw signature below`} />
        </div>
      )}
    </div>
  );
}

export function SignaturePanel({ docId, docTitle, docType="RAMS", signers=[], onClose }) {
  const [signatures, setSignatures] = useState(() => loadJSON("signatures", []));
  const [tab, setTab] = useState("sign");

  useEffect(() => { saveJSON("signatures", signatures); }, [signatures]);

  const docSigs = signatures.filter(s => s.docId === docId);
  const signedIds = new Set(docSigs.map(s => s.signerId));
  const allSigned = signers.length > 0 && signers.every(s => signedIds.has(s.id));

  return (
    <div style={{ minHeight:500, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:600 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:"#E6F1FB", color:"#0C447C" }}>{docType}</span>
            </div>
            <h3 style={{ fontWeight:500, fontSize:16, margin:0 }}>{docTitle || "Untitled"}</h3>
            <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"4px 0 0" }}>{docSigs.length} of {signers.length} signatures</p>
          </div>
          {onClose && <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>}
        </div>

        <div style={{ height:4, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:2, marginBottom:20 }}>
          <div style={{ height:4, borderRadius:2, width:signers.length>0?`${(docSigs.length/signers.length)*100}%`:"0%", background:allSigned?"#1D9E75":"#0d9488", transition:"width .4s" }} />
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:16 }}>
          {["sign","audit"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ ...ss.btn, background:tab===t?"var(--color-background-secondary,#f7f7f5)":"transparent", borderColor:tab===t?"var(--color-border-primary,#aaa)":"transparent", fontWeight:tab===t?500:400 }}>
              {t==="sign"?"Signatures":"Audit trail"}
            </button>
          ))}
        </div>

        {tab==="sign" && (
          <>
            {signers.length===0 && <div style={{ textAlign:"center", padding:"2rem 0", color:"var(--color-text-secondary)", fontSize:13 }}>No signers assigned.</div>}
            {signers.map(s=>(
              <SignatureBlock key={s.id} signer={s} docId={docId} signatures={signatures}
                onSign={(sig)=>setSignatures(prev=>[...prev,sig])}
                onClear={(id)=>setSignatures(prev=>prev.filter(s=>s.id!==id))}
              />
            ))}
            {allSigned && (
              <div style={{ marginTop:12, padding:"12px 16px", background:"#EAF3DE", borderRadius:8, display:"flex", alignItems:"center", gap:10 }}>
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#27500A" strokeWidth={1.5} strokeLinecap="round"><circle cx={8} cy={8} r={6}/><path d="M5 8l2 2 4-4"/></svg>
                <span style={{ fontSize:13, color:"#27500A", fontWeight:500 }}>All signatures collected.</span>
              </div>
            )}
          </>
        )}

        {tab==="audit" && (
          <div>
            {docSigs.length===0 && <p style={{ fontSize:13, color:"var(--color-text-secondary)", textAlign:"center", padding:"2rem 0" }}>No signatures yet.</p>}
            {docSigs.map(sig=>(
              <div key={sig.id} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", alignItems:"flex-start" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, background:"#EAF3DE", color:"#27500A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>
                  {(sig.signerName||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>{sig.signerName}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>{sig.signerRole} · {fmtDateTime(sig.timestamp)}</div>
                  {sig.gps && <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>GPS: {sig.gps.lat}, {sig.gps.lng} ±{sig.gps.accuracy}m</div>}
                </div>
                <img src={sig.dataUrl} alt="sig" style={{ height:40, width:100, objectFit:"contain", border:"0.5px solid #e5e5e5", borderRadius:4, background:"#fff" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignatureManager() {
  const [docs, setDocs] = useState(()=>loadJSON("sig_docs",[]));
  const [workers] = useState(()=>loadJSON("mysafeops_workers",[]));
  const [activeDoc, setActiveDoc] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newDoc, setNewDoc] = useState({ title:"", type:"RAMS", signerIds:[] });
  const [allSigs, setAllSigs] = useState(()=>loadJSON("signatures",[]));

  useEffect(()=>{ saveJSON("sig_docs",docs); },[docs]);
  useEffect(()=>{ saveJSON("signatures",allSigs); },[allSigs]);

  const docTypes = ["RAMS","Method Statement","Permit","Toolbox Talk","Induction","Inspection","Other"];
  const initials = (n) => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const addDoc = () => {
    if (!newDoc.title.trim()) return;
    const d = { id:genId(), title:newDoc.title.trim(), type:newDoc.type, signerIds:newDoc.signerIds, createdAt:new Date().toISOString() };
    setDocs(prev=>[d,...prev]);
    setNewDoc({ title:"", type:"RAMS", signerIds:[] });
    setShowNew(false);
    setActiveDoc(d);
  };

  const deleteDoc = (id) => {
    setDocs(prev=>prev.filter(d=>d.id!==id));
    setAllSigs(prev=>prev.filter(s=>s.docId!==id));
    if (activeDoc?.id===id) setActiveDoc(null);
  };

  const sigCount = (docId) => allSigs.filter(s=>s.docId===docId).length;

  if (activeDoc) {
    const signers = workers.filter(w=>activeDoc.signerIds?.includes(w.id));
    return (
      <div style={{ fontFamily:"DM Sans, system-ui, sans-serif", padding:"1rem 0" }}>
        <button onClick={()=>setActiveDoc(null)} style={{ ...ss.btn, marginBottom:16, fontSize:12 }}>← Back</button>
        <SignaturePanel docId={activeDoc.id} docTitle={activeDoc.title} docType={activeDoc.type} signers={signers} onClose={()=>setActiveDoc(null)} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"DM Sans, system-ui, sans-serif", padding:"1.25rem 0", fontSize:14 }}>
      <PageHero
        badgeText="SIG"
        title="Digital signatures"
        lead="Collect signatures with GPS and timestamp per document."
        right={
          <button type="button" onClick={() => setShowNew(true)} style={ss.btnPrimary}>
            + New document
          </button>
        }
      />

      {showNew && (
        <div style={{ ...ss.card, marginBottom:20, border:"0.5px solid #9FE1CB" }}>
          <div style={{ fontWeight:500, fontSize:14, marginBottom:14 }}>New document for signing</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
            <div>
              <label style={ss.label}>Document title</label>
              <input value={newDoc.title} onChange={e=>setNewDoc(n=>({...n,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addDoc()} placeholder="e.g. RAMS — Kettle removal" style={ss.input} />
            </div>
            <div>
              <label style={ss.label}>Type</label>
              <select value={newDoc.type} onChange={e=>setNewDoc(n=>({...n,type:e.target.value}))} style={{ ...ss.input, width:"auto" }}>
                {docTypes.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {workers.length>0 && (
            <div style={{ marginBottom:14 }}>
              <label style={ss.label}>Required signers</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {workers.map(w=>{
                  const sel = newDoc.signerIds.includes(w.id);
                  return (
                    <button key={w.id} onClick={()=>setNewDoc(n=>({ ...n, signerIds:sel?n.signerIds.filter(id=>id!==w.id):[...n.signerIds,w.id] }))}
                      style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)", color:sel?"#E1F5EE":"var(--color-text-primary)", border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)", fontFamily:"DM Sans, sans-serif" }}>
                      {w.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {workers.length===0 && <p style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:12 }}>Add workers first to assign them as signers.</p>}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowNew(false)} style={ss.btn}>Cancel</button>
            <button onClick={addDoc} disabled={!newDoc.title.trim()} style={{ ...ss.btnPrimary, opacity:newDoc.title.trim()?1:0.4 }}>Create & sign</button>
          </div>
        </div>
      )}

      {docs.length===0 && !showNew && (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No documents awaiting signatures yet.</p>
          <button onClick={()=>setShowNew(true)} style={ss.btnPrimary}>+ Add first document</button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {docs.map(doc=>{
          const signers = workers.filter(w=>doc.signerIds?.includes(w.id));
          const signed = sigCount(doc.id);
          const total = signers.length;
          const pct = total>0?(signed/total)*100:0;
          const complete = total>0&&signed===total;
          return (
            <div key={doc.id} style={{ ...ss.card, display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
              onClick={()=>setActiveDoc(doc)}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#5DCAA5"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--color-border-tertiary,#e5e5e5)"}>
              <span style={{ padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:500, background:"#E6F1FB", color:"#0C447C", whiteSpace:"nowrap", flexShrink:0 }}>{doc.type}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:500, fontSize:14, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.title}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ flex:1, height:3, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:2, maxWidth:120 }}>
                    <div style={{ height:3, borderRadius:2, width:`${pct}%`, background:complete?"#1D9E75":"#0d9488", transition:"width .3s" }} />
                  </div>
                  <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{signed}/{total} signed</span>
                  <span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>{fmtDateTime(doc.createdAt)}</span>
                </div>
              </div>
              <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:complete?"#EAF3DE":total===0?"var(--color-background-secondary,#f7f7f5)":"#FAEEDA", color:complete?"#27500A":total===0?"var(--color-text-secondary)":"#633806", flexShrink:0 }}>
                {complete?"Complete":total===0?"No signers":"Pending"}
              </span>
              <button onClick={e=>{e.stopPropagation();deleteDoc(doc.id);}} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, flexShrink:0 }}>×</button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:24, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Each signature captures: drawn image · signer name &amp; role · date/time · GPS coordinates · device info. Data is isolated per organisation.
      </div>
    </div>
  );
}
