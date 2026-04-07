// ═══ RAMS Pro — Utilities ═══
import { uid, td, nw, fmt, dTo, DT, ST, AUTO_PPE, HAZARD_LIBRARY, CTRL_SUGGEST } from './data.js';

// ═══ RISK CALCULATIONS ═══
export const riskScore=(l,s)=>(l+1)*(s+1);
export const riskLevel=s=>s<=4?"Low — Acceptable":s<=9?"Medium — Monitor":s<=15?"High — Action Required":"Critical — STOP WORK";
export const riskShort=s=>s<=4?"low":s<=9?"med":s<=15?"high":"crit";
export const RISK_COLORS={low:"#22c55e",med:"#eab308",high:"#f97316",crit:"#ef4444"};
export const riskBg=s=>s<=4?"#166534":s<=9?"#854d0e":s<=15?"#9a3412":"#991b1b";

// ═══ AUTO-NUMBER ═══
export const nextNo=(docs,prefix)=>{
  const nums=docs.filter(d=>d.no?.startsWith(prefix)).map(d=>parseInt(d.no.replace(prefix,""))||0);
  return prefix+String((Math.max(0,...nums)+1)).padStart(3,"0");
};

// ═══ DOC COMPLETENESS ═══
export const docPct=(d)=>{
  if(!d)return 0;const c=[];
  if(d.dt==="rams")c.push(!!d.wd,!!d.wl,!!d.pb,(d.hazards||[]).some(h=>h.h),(d.steps||[]).some(s=>s.d),(d.ppe||[]).length>0,!!d.ep);
  else if(d.dt?.startsWith("permit_"))c.push(!!d.loc,!!d.ib,!!d.vF,!!d.vT,!!d.desc,!!d.ctrl);
  else if(d.dt==="sitereport")c.push(!!d.date,!!d.wDone,!!d.by);
  else if(d.dt==="dayreport")c.push(!!d.date,!!d.wc,!!d.by);
  else if(d.dt==="instruction")c.push(!!d.subj,!!d.desc,!!d.ib,!!d.it);
  else if(d.dt==="incident")c.push(!!d.date,!!d.desc,!!d.type,!!d.reportedBy,!!d.immAction);
  else return 50;
  return c.length?Math.round(c.filter(Boolean).length/c.length*100):0;
};

// ═══ COMPLIANCE SCORE ═══
export const calcCompliance=(prj,docs,wkr)=>{
  const pDocs=docs.filter(d=>d.pid===prj.id);
  if(!pDocs.length&&!wkr.length)return{score:0,items:[]};
  const items=[];let total=0,passed=0;

  const approved=pDocs.filter(d=>d.st==="approved").length;
  const docScore=pDocs.length?Math.round(approved/pDocs.length*100):0;
  items.push({label:"Documents Approved",value:`${approved}/${pDocs.length}`,pct:docScore,clr:docScore>=80?"#22c55e":docScore>=50?"#eab308":"#ef4444"});
  total+=100;passed+=docScore;

  const hasRAMS=pDocs.some(d=>d.dt==="rams");
  items.push({label:"RAMS Created",value:hasRAMS?"Yes":"No",pct:hasRAMS?100:0,clr:hasRAMS?"#22c55e":"#ef4444"});
  total+=100;passed+=hasRAMS?100:0;

  const hasEmerg=!!prj.ae&&!!prj.ec&&!!prj.ap;
  items.push({label:"Emergency Info Complete",value:hasEmerg?"Complete":"Missing",pct:hasEmerg?100:0,clr:hasEmerg?"#22c55e":"#ef4444"});
  total+=100;passed+=hasEmerg?100:0;

  const allValid=wkr.every(w=>w.certs.every(c=>!c.expiry||dTo(c.expiry)>0));
  const certPct=wkr.length?Math.round(wkr.filter(w=>w.certs.every(c=>!c.expiry||dTo(c.expiry)>0)).length/wkr.length*100):100;
  items.push({label:"Worker Certs Valid",value:allValid?"All Valid":`${certPct}%`,pct:certPct,clr:certPct>=80?"#22c55e":certPct>=50?"#eab308":"#ef4444"});
  total+=100;passed+=certPct;

  const permits=pDocs.filter(d=>d.dt?.startsWith("permit_")&&d.st==="approved");
  const validP=permits.filter(d=>!d.vT||new Date(d.vT)>new Date()).length;
  const pPct=permits.length?Math.round(validP/permits.length*100):100;
  items.push({label:"Permits Valid",value:permits.length?`${validP}/${permits.length}`:"N/A",pct:pPct,clr:pPct>=80?"#22c55e":"#ef4444"});
  total+=100;passed+=pPct;

  return{score:total?Math.round(passed/total*100):0,items};
};

// ═══ SUGGEST CONTROLS ═══
export const suggestControls=(hazardText)=>{
  if(!hazardText)return[];
  const h=hazardText.toLowerCase();const matches=[];
  const keywords={
    fall:["height","fall","scaffold","roof","ladder","edge","platform"],
    electric:["electr","shock","cable","wire","voltage","current"],
    fire:["fire","burn","weld","hot","spark","flame","ignit"],
    noise:["noise","loud","hearing","decibel","db"],
    dust:["dust","silica","inhal","airborne","respiratory","asbestos"],
    manual:["manual","lift","handling","carry","heavy","musculo","back"],
    vehicle:["vehicle","traffic","struck","plant","machine","lorry","truck","van","car"],
    collapse:["collapse","trench","excavat","burial","cave","unstable","ground"],
    chemical:["chemical","substance","hazardous","cement","bitumen","solvent","acid","toxic","coshh"],
    confined:["confined","enclosed","manhole","tank","chamber","vessel","sewer","silo"],
  };
  Object.entries(keywords).forEach(([key,words])=>{
    if(words.some(w=>h.includes(w))&&CTRL_SUGGEST[key]){matches.push(...CTRL_SUGGEST[key])}
  });
  return[...new Set(matches)];
};

// ═══ BLANK DOCUMENT FACTORIES ═══
export const blankHazard=()=>({id:uid(),a:"",h:"",w:"",cB:"",lB:2,sB:2,cA:"",lA:1,sA:1});
export const blankStep=(n)=>({id:uid(),n,d:"",r:"",hz:""});

export const blankProject=()=>({
  id:uid(),cr:td(),up:td(),
  nm:"",ref:"",addr:"",postcode:"",w3w:"",client:"",principalDesigner:"",principalContractor:"",
  cdm:false,sd:td(),ed:"",desc:"",
  siteManager:"",siteSupervisor:"",hsAdvisor:"",
  ae:"",ap:"",ec:"",emergProc:"",
  lat:null,lng:null,
  siteHours:"Mon-Fri 08:00-17:00",parking:"",deliveryInstr:"",accessNotes:"",siteRules:"",
  planImg:null,markers:[],
  customFields:[],
});

export const blankRAMS=(pid,trade="General Construction")=>({
  id:uid(),pid,dt:"rams",st:"draft",cr:td(),up:td(),
  tr:trade,no:"",pb:"",rb:"",ab:"",rev:"01",
  wd:"",wl:"",sd:td(),ed:"",wh:"08:00–17:00",
  hazards:[blankHazard()],steps:[blankStep(1)],
  ppe:AUTO_PPE[trade]||AUTO_PPE["General Construction"]||[],
  equip:[],workers:[],
  ep:"In case of emergency:\n1. Make the area safe — do not put yourself at risk\n2. Call 999 (or site emergency number)\n3. Administer first aid if trained to do so\n4. Evacuate to designated assembly point\n5. Report to site supervisor / manager immediately\n6. Do not re-enter area until declared safe",
  coshh:"",welfareNotes:"",
  toolboxDate:"",toolboxBy:"",toolboxAttendees:"",
  monitorReview:"This RAMS shall be reviewed:\n- Before work commences (or if any conditions change)\n- If there is any incident, near miss or change in personnel\n- Monthly as minimum, or per project phase\n- By competent person",
  photos:[],notes:"",sigs:[],customFields:[],
});

export const blankPermit=(pid,pt="permit_general")=>({
  id:uid(),pid,dt:pt,st:"draft",cr:td(),up:td(),
  no:"",loc:"",ib:"",auth:"",recv:"",vF:nw(),vT:"",wrk:"",maxPersons:"",
  desc:"",haz:"",ctrl:"",ppeReq:"",emrg:"",commMethod:"",
  // Hot work
  fw:"",fwDuration:"60 minutes after work ceases",fxType:"",combCl:false,sprinklers:false,detIso:false,areaScreened:false,
  // Height
  eqType:"",mxH:"",edgeP:"",fallA:"",rescue:"",eqInsp:false,inspDate:"",inspBy:"",
  // Confined
  spDesc:"",atmTest:false,o2:"",co:"",h2s:"",lel:"",ventType:"",standby:"",entryProc:"",rescueEq:"",
  // Electrical
  circId:"",volt:"",isoPoint:"",loto:"",testDead:false,earthsApp:false,testInstr:"",
  // Excavation
  mxDep:"",shore:"",battered:false,svcId:false,catG:false,svcDwg:false,edgeBar:"",
  // Lifting
  liftRef:"",loadW:"",crane:"",slinger:"",slingsOk:false,exclZn:false,windLim:"",liftPlan:false,
  // Closure
  clBy:"",clDate:"",clTime:"",areaSafe:false,
  workers:[],photos:[],notes:"",sigs:[],customFields:[],
});

export const blankSiteReport=(pid)=>({
  id:uid(),pid,dt:"sitereport",st:"draft",cr:td(),up:td(),
  no:"",date:td(),weather:"",temp:"",wind:"",humidity:"",
  pCount:"",contractors:"",subContractors:"",visitors:"",
  wDone:"",wPlanned:"",issues:"",delays:"",
  matDelivered:"",matRequired:"",plantOnSite:"",plantRequired:"",
  hs:"",nearM:"",accidents:"",incRef:"",qualityIssues:"",
  instructions:"",nextDayPlan:"",photoRef:"",
  photos:[],by:"",notes:"",sigs:[],customFields:[],
});

export const blankDayReport=(pid)=>({
  id:uid(),pid,dt:"dayreport",st:"draft",cr:td(),up:td(),
  date:td(),shift:"Day",startTime:"08:00",endTime:"17:00",
  supervisor:"",foreman:"",
  labourCount:"",labourDetails:"",
  plantUsed:"",materialsUsed:"",
  workCarriedOut:"",measurements:"",
  delays:"",delayHours:"",delayCause:"",
  weatherCond:"",weatherImpact:"",
  safetyObs:"",incidents:"",dayworkRef:"",
  photos:[],by:"",notes:"",sigs:[],customFields:[],
});

export const blankInstruction=(pid)=>({
  id:uid(),pid,dt:"instruction",st:"draft",cr:td(),up:td(),
  no:"",ib:"",it:"",date:td(),rev:"01",
  subj:"",desc:"",reason:"",action:"",
  completionDate:"",costImplication:"",drawingRef:"",
  response:"",responseDate:"",respondedBy:"",
  photos:[],notes:"",sigs:[],customFields:[],
});

export const blankIncident=(pid)=>({
  id:uid(),pid,dt:"incident",st:"draft",cr:td(),up:td(),
  no:"",date:td(),time:"",type:"Near Miss",loc:"",
  desc:"",injuredPerson:"",injuryType:"",bodyPart:"",witness:"",
  immAction:"",rootCause:"",corrAction:"",corrBy:"",corrDate:"",
  reportedBy:"",reportedTo:"",riddor:false,riddorRef:"",
  photos:[],notes:"",sigs:[],customFields:[],
});

export const blankWorker=()=>({
  id:uid(),cr:td(),
  nm:"",role:"",company:"",phone:"",email:"",
  cscsNo:"",cscsType:"",niNo:"",
  emergContact:"",emergPhone:"",bloodType:"",allergies:"",medicalConditions:"",
  certs:[],notes:"",active:true,
  customFields:[],
});

export const blankCert=()=>({id:uid(),type:"",number:"",issued:"",expiry:"",notes:"",fileRef:""});

export const blankVehicle=()=>({
  id:uid(),cr:td(),
  reg:"",make:"",model:"",year:"",color:"",type:"Van (SWB)",
  vin:"",fuelType:"Diesel",
  motExpiry:"",motCertNo:"",
  insuranceExpiry:"",insuranceProvider:"",insurancePolicyNo:"",
  taxExpiry:"",
  serviceDate:"",serviceNext:"",serviceMileage:"",
  breakdownCover:"",breakdownExpiry:"",
  assignedDriver:"",assignedDriverId:"",
  oLicence:"",oLicenceExpiry:"",
  tacho:false,tachoCal:"",
  trackerFitted:false,dashcamFitted:false,
  maxWeight:"",payload:"",
  checks:[],lastCheck:"",
  defects:"",notes:"",active:true,
  customFields:[],
});

export const blankEquipment=(pid)=>({
  id:uid(),pid,cr:td(),
  nm:"",type:"",category:"",make:"",model:"",serialNo:"",assetNo:"",
  purchaseDate:"",supplier:"",
  inspectionDate:"",inspectionBy:"",inspectionNext:"",inspectionFreq:"Monthly",inspectionCert:"",
  calibrationDate:"",calibrationBy:"",calibrationNext:"",calibrationCert:"",calibrationFreq:"Annual",
  patDate:"",patNext:"",patResult:"",
  status:"In Service", // In Service, Defective, Out of Service, Calibration Due, Quarantined, Disposed
  location:"",assignedTo:"",
  swl:"", // Safe Working Load (for lifting equipment)
  lolerDate:"",lolerNext:"",lolerCert:"",
  checks:[],lastCheck:"",
  defects:"",defectReported:"",defectResolved:"",
  notes:"",active:true,
  customFields:[],
});

export const blankPhoto=(pid)=>({
  id:uid(),pid,cr:td(),
  data:null,desc:"",cat:"",
  lat:null,lng:null,accuracy:null,
  ts:new Date().toISOString(),
  takenBy:"",notes:"",
  linkedDocs:[],
});

export const blankInduction=(pid,wid)=>({
  id:uid(),pid,wid,date:td(),inductedBy:"",
  items:{
    "Site induction presented and understood":false,
    "Site rules and working hours explained":false,
    "Fire evacuation procedure and assembly point":false,
    "First aid facilities and first aiders identified":false,
    "PPE requirements for this site":false,
    "Hazard and near-miss reporting procedure":false,
    "Welfare facilities location (toilets, rest, water)":false,
    "Emergency procedures (spill, gas leak, injury)":false,
    "Relevant RAMS reviewed and understood":false,
    "Permit to work system explained":false,
    "Environmental requirements (waste, noise, dust)":false,
    "Accident reporting procedure (inc. RIDDOR)":false,
    "Site-specific hazards briefed":false,
    "Drugs and alcohol policy":false,
    "Mobile phone policy on site":false,
  },
  notes:"",completed:false,
});

export const blankCustomField=()=>({
  id:uid(),label:"",type:"text",value:"",required:false,options:"",
  // type: text, textarea, number, date, select, checkbox, email, tel
});

// ═══ PDF EXPORT ═══
export function exportPDF(doc,proj,org,workers=[]){
  const dt=DT[doc.dt]||{l:"Document",i:"📄",c:"#333"};
  const assignedWorkers=(doc.workers||[]).map(id=>workers.find(w=>w.id===id)).filter(Boolean);
  const pc=org.primaryColor||"#f97316";

  const logoHtml=org.logo?`<img src="${org.logo}" style="max-height:50px;max-width:200px;object-fit:contain" alt="Logo"/>`:
    `<div style="font-size:20px;font-weight:800;color:${pc}">${org.nm}</div>`;

  const css=`<style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{background:#fff;color:#1a1a1a;font-size:10.5px;line-height:1.5}
    @page{size:A4;margin:12mm 15mm}
    .page{page-break-after:always}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${pc};padding-bottom:8px;margin-bottom:12px}
    .header-right{text-align:right;font-size:9px;color:#666}
    .doc-title{font-size:18px;font-weight:700;color:${pc};margin:4px 0}
    .doc-sub{font-size:10px;color:#666}
    .section{margin-bottom:12px}
    .section-title{font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px}
    .field{margin-bottom:4px}
    .field-label{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:.5px}
    .field-value{font-size:10.5px;color:#1a1a1a;white-space:pre-line}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
    table{width:100%;border-collapse:collapse;margin:4px 0;font-size:9.5px}
    th{background:${pc};color:#fff;padding:4px 6px;text-align:left;font-weight:600;font-size:9px}
    td{border:1px solid #ddd;padding:3px 6px;vertical-align:top}
    .risk{display:inline-block;padding:1px 8px;border-radius:3px;font-weight:700;font-size:9px;color:#fff}
    .ppe-tag{display:inline-block;background:#f0f0f0;border:1px solid #ddd;border-radius:3px;padding:1px 6px;margin:1px;font-size:8.5px}
    .worker-card{background:#f8f8f8;border:1px solid #ddd;border-radius:4px;padding:5px 8px;margin-bottom:3px;font-size:9px}
    .cert-ok{color:#16a34a;font-weight:600}.cert-exp{color:#dc2626;font-weight:600}
    .footer{text-align:center;font-size:7.5px;color:#999;margin-top:12px;border-top:1px solid #eee;padding-top:4px}
    .cover{text-align:center;padding-top:80px}
    .cover-logo{margin-bottom:40px}
    .cover-title{font-size:26px;font-weight:800;color:${pc};margin-top:40px}
    .cover-sub{font-size:14px;color:#666;margin-top:8px}
    .cover-detail{font-size:11px;color:#888;margin-top:4px}
    .stamp{display:inline-block;border:3px solid;border-radius:8px;padding:6px 20px;font-size:16px;font-weight:800;transform:rotate(-5deg);margin-top:30px;text-transform:uppercase}
    .stamp-approved{border-color:#16a34a;color:#16a34a}
    .stamp-draft{border-color:#6b7280;color:#6b7280}
    .stamp-pending{border-color:#ca8a04;color:#ca8a04}
    .stamp-rejected{border-color:#dc2626;color:#dc2626}
    .stamp-closed{border-color:#2563eb;color:#2563eb}
    .toc-item{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #ccc;font-size:10px}
    .law-ref{font-size:8px;color:#888;font-style:italic}
    .custom-field{background:#fafafa;border:1px solid #eee;border-radius:3px;padding:4px 6px;margin-bottom:3px}
    @media print{.no-print{display:none}}
  </style>`;

  let html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${dt.l} — ${doc.no||"Document"}</title>${css}</head><body>`;

  // ═══ COVER PAGE ═══
  html+=`<div class="page cover">
    <div class="cover-logo">${logoHtml}</div>
    ${org.addr?`<div style="font-size:10px;color:#aaa;margin-top:4px">${org.addr}</div>`:""}
    ${org.ph?`<div style="font-size:10px;color:#aaa">${org.ph} ${org.em?`· ${org.em}`:""}</div>`:""}
    <div class="cover-title">${dt.i} ${dt.l}</div>
    ${doc.tr?`<div class="cover-sub">Trade: ${doc.tr}</div>`:""}
    <div class="cover-sub">${proj?.nm||"Project"}</div>
    <div class="cover-detail">${doc.no||""} · Revision: ${doc.rev||"01"} · Date: ${fmt(doc.cr)}</div>
    <div class="stamp stamp-${doc.st}">${ST[doc.st]?.ic||""} ${ST[doc.st]?.l||doc.st}</div>
    <div style="margin-top:60px;font-size:10px;color:#999">
      <div>Project: ${proj?.nm||"—"} · Ref: ${proj?.ref||"—"}</div>
      <div>Site: ${proj?.addr||"—"} ${proj?.postcode||""}</div>
      <div>Client: ${proj?.client||"—"}</div>
      <div>Prepared by: ${doc.pb||doc.by||doc.ib||"—"} · Date: ${fmt(doc.cr)}</div>
    </div>
    <div style="margin-top:20px;font-size:8px;color:#bbb">${org.docFooter||""}</div>
    <div class="law-ref" style="margin-top:8px">${(dt.laws||[]).join(" · ")}</div>
  </div>`;

  // ═══ TABLE OF CONTENTS ═══
  const sections=[];
  if(doc.dt==="rams"){
    sections.push("Project Information","Personnel & Responsibilities","Scope of Work","Hazard Identification & Risk Assessment","Method Statement — Safe System of Work","PPE Requirements","Equipment","COSHH Assessment","Emergency Procedures","Workers & Competency","Monitoring & Review","Signatures & Acknowledgement");
  }else if(doc.dt?.startsWith("permit_")){
    sections.push("Permit Details","Work Description & Controls","Type-Specific Requirements","Workers & Competency","Permit Closure","Signatures");
  }else if(doc.dt==="incident"){
    sections.push("Incident Details","Investigation & Root Cause","Corrective Actions","Signatures");
  }else{
    sections.push("Document Details","Content","Signatures");
  }

  html+=`<div class="page">
    <div class="header"><div>${logoHtml}</div><div class="header-right">${doc.no||""}<br/>${fmt(doc.cr)}<br/>Rev ${doc.rev||"01"}</div></div>
    <div class="section"><div class="section-title">📋 Table of Contents</div>`;
  sections.forEach((s,i)=>{html+=`<div class="toc-item"><span>${i+1}. ${s}</span><span>Page ${i+3}</span></div>`});
  html+=`</div></div>`;

  // ═══ DOCUMENT CONTENT ═══
  const hdr=`<div class="header"><div>${logoHtml}</div><div class="header-right">${doc.no||""} · Rev ${doc.rev||"01"}<br/>${fmt(doc.cr)}<br/>${org.nm}</div></div>`;
  const ftr=`<div class="footer">${org.nm} · ${doc.no||""} · Rev ${doc.rev||"01"} · ${fmt(doc.cr)} · UK Health & Safety Compliant · Produced by RAMS Pro</div>`;

  html+=`<div class="page">${hdr}`;
  html+=`<div class="doc-title">${dt.i} ${dt.l}${doc.tr?` — ${doc.tr}`:""}</div>`;
  html+=`<div class="doc-sub">Project: ${proj?.nm||"—"} | Site: ${proj?.addr||"—"} ${proj?.postcode||""}</div>`;
  html+=`<div class="law-ref" style="margin-top:4px">Produced in accordance with: ${(dt.laws||[]).join(", ")}</div>`;

  // === RAMS CONTENT ===
  if(doc.dt==="rams"){
    html+=`<div class="section"><div class="section-title">1. Project Information</div>
      <div class="grid"><div class="field"><div class="field-label">Project Name</div><div class="field-value">${proj?.nm||"—"}</div></div><div class="field"><div class="field-label">Project Reference</div><div class="field-value">${proj?.ref||"—"}</div></div><div class="field"><div class="field-label">Client</div><div class="field-value">${proj?.client||"—"}</div></div><div class="field"><div class="field-label">Site Address</div><div class="field-value">${proj?.addr||"—"} ${proj?.postcode||""}</div></div>${proj?.cdm?`<div class="field"><div class="field-label">CDM Status</div><div class="field-value" style="color:#dc2626;font-weight:700">⚠️ CDM NOTIFIABLE PROJECT</div></div>`:""}</div></div>`;

    html+=`<div class="section"><div class="section-title">2. Personnel & Responsibilities</div>
      <div class="grid"><div class="field"><div class="field-label">Prepared By</div><div class="field-value">${doc.pb||"—"}</div></div><div class="field"><div class="field-label">Reviewed By</div><div class="field-value">${doc.rb||"—"}</div></div><div class="field"><div class="field-label">Approved By</div><div class="field-value">${doc.ab||"—"}</div></div><div class="field"><div class="field-label">Site Supervisor</div><div class="field-value">${proj?.siteSupervisor||"—"}</div></div><div class="field"><div class="field-label">Site Manager</div><div class="field-value">${proj?.siteManager||"—"}</div></div></div></div>`;

    html+=`<div class="section"><div class="section-title">3. Scope of Work</div>
      <div class="field"><div class="field-label">Trade / Activity</div><div class="field-value">${doc.tr||"—"}</div></div>
      <div class="field"><div class="field-label">Description of Work</div><div class="field-value">${doc.wd||"—"}</div></div>
      <div class="grid"><div class="field"><div class="field-label">Location on Site</div><div class="field-value">${doc.wl||"—"}</div></div><div class="field"><div class="field-label">Duration</div><div class="field-value">${fmt(doc.sd)} to ${fmt(doc.ed)}</div></div><div class="field"><div class="field-label">Working Hours</div><div class="field-value">${doc.wh||"—"}</div></div></div></div>`;

    // Hazards table
    html+=`<div class="section"><div class="section-title">4. Hazard Identification & Risk Assessment</div>
      <div class="law-ref">In accordance with MHSWR 1999 Regulation 3 — duty to make suitable and sufficient assessment of risks</div>
      <table><tr><th>#</th><th>Activity</th><th>Hazard</th><th>Persons at Risk</th><th>Existing Controls</th><th>Initial Risk</th><th>Additional Controls</th><th>Residual Risk</th></tr>`;
    (doc.hazards||[]).forEach((h,i)=>{
      const scB=(h.lB+1)*(h.sB+1),scA=(h.lA+1)*(h.sA+1);
      html+=`<tr><td style="text-align:center;font-weight:700">${i+1}</td><td>${h.a||"—"}</td><td>${h.h||"—"}</td><td>${h.w||"—"}</td><td>${(h.cB||"—").replace(/\n/g,"<br/>")}</td><td style="text-align:center"><span class="risk" style="background:${riskBg(scB)}">${scB}</span></td><td>${(h.cA||"—").replace(/\n/g,"<br/>")}</td><td style="text-align:center"><span class="risk" style="background:${riskBg(scA)}">${scA}</span></td></tr>`;
    });
    html+=`</table>
      <div style="margin-top:6px;font-size:8px;color:#666"><strong>Risk Matrix Key:</strong> 1-4 = Low (Acceptable) · 5-9 = Medium (Monitor) · 10-15 = High (Action Required) · 16-25 = Critical (STOP WORK)</div></div>`;

    // Method Statement
    html+=`<div class="section"><div class="section-title">5. Method Statement — Safe System of Work</div>
      <div class="law-ref">CDM 2015 Regulation 12 — Construction phase plan must include arrangements for safe systems of work</div>
      <table><tr><th>Step</th><th>Description</th><th>Responsible Person</th></tr>`;
    (doc.steps||[]).forEach((s,i)=>{html+=`<tr><td style="text-align:center;font-weight:700">${i+1}</td><td>${(s.d||"—").replace(/\n/g,"<br/>")}</td><td>${s.r||"—"}</td></tr>`});
    html+=`</table></div>`;

    // PPE
    html+=`<div class="section"><div class="section-title">6. PPE Requirements</div>
      <div class="law-ref">In accordance with PPER 2022 — Personal Protective Equipment at Work Regulations</div><div>`;
    (doc.ppe||[]).forEach(p=>{html+=`<span class="ppe-tag">✓ ${p}</span> `});
    html+=`</div></div>`;

    // Equipment
    if((doc.equip||[]).length){
      html+=`<div class="section"><div class="section-title">7. Equipment</div><div>`;
      doc.equip.forEach(e=>{html+=`<span class="ppe-tag">${e}</span> `});
      html+=`</div></div>`;
    }

    // COSHH
    if(doc.coshh){
      html+=`<div class="section"><div class="section-title">8. COSHH Assessment</div>
        <div class="law-ref">COSHH 2002 — Control of Substances Hazardous to Health</div>
        <div class="field-value">${doc.coshh.replace(/\n/g,"<br/>")}</div></div>`;
    }

    // Emergency
    html+=`<div class="section"><div class="section-title">9. Emergency Procedures</div>
      <div class="field-value">${(doc.ep||"—").replace(/\n/g,"<br/>")}</div>
      <div class="grid" style="margin-top:6px"><div class="field"><div class="field-label">Nearest A&E / Hospital</div><div class="field-value" style="font-weight:700;color:#dc2626">${proj?.ae||"—"}</div></div><div class="field"><div class="field-label">Emergency Contact Number</div><div class="field-value" style="font-weight:700;color:#dc2626">${proj?.ec||"—"}</div></div><div class="field"><div class="field-label">Fire Assembly Point</div><div class="field-value" style="font-weight:700;color:#2563eb">${proj?.ap||"—"}</div></div></div></div>`;

    // Workers
    if(assignedWorkers.length){
      html+=`<div class="section"><div class="section-title">10. Workers & Competency</div>`;
      assignedWorkers.forEach(w=>{
        html+=`<div class="worker-card"><strong>${w.nm}</strong> — ${w.role||"—"} · ${w.company||"—"}`;
        if(w.cscsNo)html+=` · CSCS: ${w.cscsNo} (${w.cscsType||""})`;
        html+=`<br/>`;
        w.certs.filter(c=>!c.expiry||dTo(c.expiry)>0).forEach(c=>{html+=`<span class="cert-ok">✓ ${c.type} (${c.number||"—"}, exp: ${fmt(c.expiry)})</span> `});
        w.certs.filter(c=>c.expiry&&dTo(c.expiry)<=0).forEach(c=>{html+=`<span class="cert-exp">✕ ${c.type} — EXPIRED ${Math.abs(dTo(c.expiry))} days ago</span> `});
        html+=`</div>`;
      });
      html+=`</div>`;
    }

    // Monitoring
    if(doc.monitorReview){
      html+=`<div class="section"><div class="section-title">11. Monitoring & Review</div>
        <div class="field-value">${doc.monitorReview.replace(/\n/g,"<br/>")}</div></div>`;
    }
  }

  // === PERMIT CONTENT ===
  else if(doc.dt?.startsWith("permit_")){
    html+=`<div class="section"><div class="section-title">1. Permit Details</div>
      <div class="grid"><div class="field"><div class="field-label">Permit Number</div><div class="field-value">${doc.no||"—"}</div></div><div class="field"><div class="field-label">Location of Work</div><div class="field-value">${doc.loc||"—"}</div></div><div class="field"><div class="field-label">Issued By</div><div class="field-value">${doc.ib||"—"}</div></div><div class="field"><div class="field-label">Authorised By</div><div class="field-value">${doc.auth||"—"}</div></div><div class="field"><div class="field-label">Valid From</div><div class="field-value" style="font-weight:700">${doc.vF||"—"}</div></div><div class="field"><div class="field-label">Valid Until</div><div class="field-value" style="font-weight:700;color:#dc2626">${doc.vT||"—"}</div></div></div></div>`;
    html+=`<div class="section"><div class="section-title">2. Work Description & Controls</div>
      <div class="field"><div class="field-label">Description</div><div class="field-value">${(doc.desc||"—").replace(/\n/g,"<br/>")}</div></div>
      <div class="field"><div class="field-label">Hazards</div><div class="field-value">${(doc.haz||"—").replace(/\n/g,"<br/>")}</div></div>
      <div class="field"><div class="field-label">Control Measures</div><div class="field-value">${(doc.ctrl||"—").replace(/\n/g,"<br/>")}</div></div></div>`;
  }

  // === INCIDENT ===
  else if(doc.dt==="incident"){
    html+=`<div class="section"><div class="section-title">1. Incident Details</div>
      <div class="grid"><div class="field"><div class="field-label">Date</div><div class="field-value">${fmt(doc.date)}</div></div><div class="field"><div class="field-label">Time</div><div class="field-value">${doc.time||"—"}</div></div><div class="field"><div class="field-label">Type</div><div class="field-value" style="font-weight:700">${doc.type}</div></div><div class="field"><div class="field-label">Location</div><div class="field-value">${doc.loc||"—"}</div></div></div>
      <div class="field"><div class="field-label">Description</div><div class="field-value">${(doc.desc||"—").replace(/\n/g,"<br/>")}</div></div>
      ${doc.riddor?`<div style="background:#fee2e2;border:2px solid #dc2626;border-radius:4px;padding:6px;margin-top:6px;font-weight:700;color:#dc2626">⚠️ RIDDOR REPORTABLE — Ref: ${doc.riddorRef||"To be assigned"}</div>`:""}</div>`;
    html+=`<div class="section"><div class="section-title">2. Investigation</div>
      <div class="field"><div class="field-label">Immediate Actions</div><div class="field-value">${(doc.immAction||"—").replace(/\n/g,"<br/>")}</div></div>
      <div class="field"><div class="field-label">Root Cause</div><div class="field-value">${(doc.rootCause||"—").replace(/\n/g,"<br/>")}</div></div>
      <div class="field"><div class="field-label">Corrective Actions</div><div class="field-value">${(doc.corrAction||"—").replace(/\n/g,"<br/>")}</div></div></div>`;
  }

  // === GENERIC (reports, instructions) ===
  else{
    html+=`<div class="section">`;
    const skip=["id","pid","dt","st","cr","up","no","rev","sigs","photos","workers","customFields"];
    Object.entries(doc).filter(([k,v])=>!skip.includes(k)&&v&&typeof v==="string").forEach(([k,v])=>{
      const label=k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
      html+=`<div class="field"><div class="field-label">${label}</div><div class="field-value">${v.replace(/\n/g,"<br/>")}</div></div>`;
    });
    html+=`</div>`;
  }

  // === CUSTOM FIELDS ===
  if((doc.customFields||[]).length){
    html+=`<div class="section"><div class="section-title">Additional Information</div>`;
    doc.customFields.forEach(cf=>{
      html+=`<div class="custom-field"><div class="field-label">${cf.label}</div><div class="field-value">${cf.value||"—"}</div></div>`;
    });
    html+=`</div>`;
  }

  // === SIGNATURES ===
  html+=`<div class="section"><div class="section-title">Signatures & Acknowledgement</div>
    <div style="font-size:9px;color:#666;margin-bottom:6px">I confirm that I have read, understood and will comply with all control measures and procedures stated in this document. I understand my responsibilities under the Health and Safety at Work etc. Act 1974.</div>
    <table><tr><th style="width:30%">Name (Print)</th><th style="width:20%">Role / Position</th><th style="width:15%">Date</th><th style="width:35%">Signature</th></tr>`;
  (doc.sigs||[]).forEach(s=>{
    html+=`<tr><td>${s.nm||""}</td><td>${s.rl||""}</td><td>${fmt(s.dt)}</td><td style="height:30px"></td></tr>`;
  });
  // Add blank lines for additional signatures
  const blankSigRows=Math.max(0,6-(doc.sigs||[]).length);
  for(let i=0;i<blankSigRows;i++){html+=`<tr><td style="height:30px"></td><td></td><td></td><td></td></tr>`}
  html+=`</table></div>`;

  html+=ftr;
  html+=`</div></body></html>`;

  const win=window.open("","_blank","width=800,height=1000");
  if(win){
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(),600);
  }else{
    alert("Pop-up blocked. Please allow pop-ups for PDF export.");
  }
}
