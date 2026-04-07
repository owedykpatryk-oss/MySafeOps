import { useState, useEffect, useRef } from "react";

/* ═══ UTILS ═══ */
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const td=()=>new Date().toISOString().split("T")[0];
const nw=()=>new Date().toISOString().slice(0,16);
const fmt=d=>{if(!d)return"—";try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}catch{return d}};
const dTo=d=>{if(!d)return 999;return Math.ceil((new Date(d)-new Date())/(86400000))};
const rBg=s=>s<=4?"#166534":s<=9?"#854d0e":s<=15?"#9a3412":"#991b1b";
const rlv=s=>s<=4?"low":s<=9?"med":s<=15?"high":"crit";
const RC={low:"#22c55e",med:"#eab308",high:"#f97316",crit:"#ef4444"};
const nextNo=(docs,pre)=>{const n=docs.filter(d=>d.no?.startsWith(pre)).map(d=>parseInt(d.no.replace(pre,""))||0);return pre+String((Math.max(0,...n)+1)).padStart(3,"0")};
const docPct=d=>{if(!d)return 0;const c=[];if(d.dt==="rams")c.push(!!d.wd,!!d.wl,!!d.pb,d.hazards?.some(h=>h.h),d.steps?.some(s=>s.d),d.ppe?.length>0);else if(d.dt?.startsWith("permit_"))c.push(!!d.loc,!!d.ib,!!d.vF,!!d.vT,!!d.desc,!!d.ctrl);else if(d.dt==="sitereport")c.push(!!d.date,!!d.wDone,!!d.by);else if(d.dt==="dayreport")c.push(!!d.date,!!d.wc,!!d.by);else if(d.dt==="instruction")c.push(!!d.subj,!!d.desc,!!d.ib);else if(d.dt==="incident")c.push(!!d.date,!!d.desc,!!d.type,!!d.reportedBy);else if(d.dt==="snag")c.push(!!d.desc,!!d.loc,!!d.priority);else if(d.dt==="rfi")c.push(!!d.question,!!d.to);else return 50;return c.length?Math.round(c.filter(Boolean).length/c.length*100):0};

/* ═══ DATA ═══ */
const DT={rams:{l:"RAMS",i:"⚠️",c:"#f97316"},instruction:{l:"Instruction",i:"📌",c:"#8b5cf6"},sitereport:{l:"Site Report",i:"📋",c:"#10b981"},dayreport:{l:"Day Report",i:"📅",c:"#06b6d4"},incident:{l:"Incident",i:"🚨",c:"#ef4444"},snag:{l:"Snag/Defect",i:"🐛",c:"#f59e0b"},rfi:{l:"RFI",i:"❓",c:"#7c3aed"},permit_hotwork:{l:"Hot Work PTW",i:"🔥",c:"#ef4444"},permit_height:{l:"Height PTW",i:"🏗️",c:"#3b82f6"},permit_confined:{l:"Confined PTW",i:"⛑️",c:"#a855f7"},permit_electrical:{l:"Electrical PTW",i:"⚡",c:"#eab308"},permit_excavation:{l:"Excavation PTW",i:"⛏️",c:"#78716c"},permit_lifting:{l:"Lifting PTW",i:"🏋️",c:"#14b8a6"},permit_general:{l:"General PTW",i:"📝",c:"#64748b"}};
const ST={draft:{l:"Draft",bg:"#374151",fg:"#9ca3af",ic:"📝"},pending:{l:"Pending",bg:"#92400e",fg:"#fcd34d",ic:"⏳"},approved:{l:"Approved",bg:"#065f46",fg:"#6ee7b7",ic:"✅"},rejected:{l:"Rejected",bg:"#991b1b",fg:"#fca5a5",ic:"❌"},closed:{l:"Closed",bg:"#1e3a5f",fg:"#93c5fd",ic:"🔒"}};
const TRADES=["General Construction","Bricklaying","Welding/Hot Works","Roadworks","Electrical","Plumbing","Scaffolding","Demolition","Excavation","Roofing","Painting","Steelwork","Carpentry","HVAC","Fire Protection","Concrete","Drainage","Cladding","Food Engineering","Process Engineering","Trial Pit","Topo Survey","Utility/GPR Survey","Wall Sampling","Commissioning","Other"];
const PPE=["Hard Hat","Safety Boots","Hi-Vis","Safety Glasses","Goggles","Gloves","Chemical Gloves","Welding Gloves","Ear Defenders","Ear Plugs","FFP2","FFP3","Respirator","Welding Helmet","Face Shield","Fall Harness","Coveralls","Tyvek","Knee Pads"];
const AUTO_PPE={"General Construction":["Hard Hat","Safety Boots","Hi-Vis","Safety Glasses"],"Welding/Hot Works":["Safety Boots","Welding Helmet","Welding Gloves","Coveralls","FFP3","Ear Plugs"],"Roadworks":["Hard Hat","Safety Boots","Hi-Vis","Safety Glasses","Ear Defenders"],"Excavation":["Hard Hat","Safety Boots","Hi-Vis","Safety Glasses","Gloves"],"Demolition":["Hard Hat","Safety Boots","Hi-Vis","FFP3","Ear Defenders","Safety Glasses","Coveralls"],"Scaffolding":["Hard Hat","Safety Boots","Hi-Vis","Fall Harness","Gloves"],"Roofing":["Hard Hat","Safety Boots","Hi-Vis","Fall Harness","Gloves","Knee Pads"],"Trial Pit":["Hard Hat","Safety Boots","Hi-Vis","Gloves","Safety Glasses","FFP2"],"Topo Survey":["Safety Boots","Hi-Vis"],"Utility/GPR Survey":["Safety Boots","Hi-Vis","Safety Glasses"],"Wall Sampling":["Safety Boots","Safety Glasses","Ear Defenders","FFP3","Gloves"],"Food Engineering":["Safety Boots","Safety Glasses","Hi-Vis","Hard Hat","Gloves"],"Electrical":["Safety Boots","Safety Glasses","Gloves","Hard Hat"],"Plumbing":["Safety Boots","Safety Glasses","Gloves","Knee Pads"],"HVAC":["Safety Boots","Safety Glasses","Gloves","Hard Hat","FFP2"],"Concrete":["Hard Hat","Safety Boots","Hi-Vis","Gloves","Safety Glasses","Coveralls"],"Steelwork":["Hard Hat","Safety Boots","Hi-Vis","Fall Harness","Gloves","Safety Glasses"]};
const EQUIP=["Angle Grinder","Breaker","Circular Saw","Core Drill","SDS Drill","Generator","Compressor","Mini Digger","360 Excavator","Telehandler","MEWP","Scaffold Tower","Ladder","MIG Welder","TIG Welder","CAT & Genny","GPR Unit","Total Station","GPS Rover","Pump","Lighting Tower","Heras Fencing","Cement Mixer","Vibrating Plate"];
const CERT_T=["CSCS Card","CPCS Plant","IPAF MEWP","PASMA Towers","SSSTS","SMSTS","First Aid at Work","Emergency First Aid","Fire Marshal","Working at Height","Manual Handling","Asbestos Awareness","Confined Space","Abrasive Wheels","Hot Works","NEBOSH","IOSH Managing Safely","Slinger/Signaller","Banksman","ECS Electrical","NRSWA","Chapter 8","Scaffold Inspector","Crane Supervisor","Gas Safe","OFTEC","DBS Check"];
const PHOTO_D=["No Access—Locked","No Access—Vehicle","Leaked Water","Exposed Cable","Blocked Fire Exit","PPE Issue","Trip Hazard","Debris","Asbestos Suspected","Before—Pre Works","During—Progress","After—Completed","Snagging","Defect","Good Practice","Trial Pit Open","GPR Location","Service Exposure"];
const INC_T=["Near Miss","Minor Injury","Over-7-Day (RIDDOR)","Major Injury","Dangerous Occurrence","Property Damage","Environmental","Fire","Vehicle Accident"];
const MARKERS=[{t:"fire_exit",i:"🚪",l:"Fire Exit",c:"#ef4444"},{t:"fire_ext",i:"🧯",l:"Extinguisher",c:"#f97316"},{t:"first_aid",i:"🏥",l:"First Aid",c:"#22c55e"},{t:"assembly",i:"📍",l:"Assembly Point",c:"#3b82f6"},{t:"welfare",i:"🚽",l:"Welfare",c:"#06b6d4"},{t:"parking",i:"🅿️",l:"Parking",c:"#64748b"},{t:"office",i:"🏢",l:"Site Office",c:"#8b5cf6"},{t:"storage",i:"📦",l:"Storage",c:"#a78bfa"},{t:"exclusion",i:"⛔",l:"Exclusion Zone",c:"#dc2626"},{t:"isolation",i:"⚡",l:"Isolation Point",c:"#eab308"},{t:"access",i:"🚗",l:"Vehicle Access",c:"#10b981"},{t:"pedestrian",i:"🚶",l:"Pedestrian",c:"#06b6d4"},{t:"hazard",i:"⚠️",l:"Hazard",c:"#ef4444"},{t:"crane",i:"🏗️",l:"Crane Zone",c:"#f59e0b"},{t:"scaffold",i:"🪜",l:"Scaffold",c:"#78716c"},{t:"cctv",i:"📹",l:"CCTV",c:"#475569"},{t:"water",i:"💧",l:"Water",c:"#3b82f6"},{t:"gas",i:"🔥",l:"Gas",c:"#f97316"},{t:"electric",i:"⚡",l:"Electric",c:"#eab308"},{t:"skip",i:"🗑️",l:"Skip",c:"#78716c"},{t:"custom",i:"📌",l:"Custom",c:"#94a3b8"}];
const HLIB={"General Construction":[{a:"General",h:"Falls from height",w:"Workers",ct:"Guard rails, harness — WAHR 2005"},{a:"Materials",h:"Falling objects",w:"All",ct:"Hard hats, exclusion zones — CDM 2015"},{a:"Movement",h:"Slips trips falls",w:"All",ct:"Housekeeping, lighting, footwear"},{a:"Plant",h:"Moving machinery",w:"Workers",ct:"Guards, banksman — PUWER 1998"},{a:"Manual",h:"Manual handling injury",w:"Workers",ct:"Mechanical aids, team lift >25kg — MHOR 1992"},{a:"Cutting",h:"Dust/silica inhalation",w:"Workers",ct:"Water suppression, FFP3 — COSHH 2002"}],"Welding/Hot Works":[{a:"Welding",h:"Burns from sparks/metal",w:"Welder",ct:"Welding PPE, screens — RRFSO 2005"},{a:"Arc",h:"Arc eye UV radiation",w:"Welder, bystanders",ct:"Helmet EN175, screens"},{a:"Fumes",h:"Toxic welding fumes",w:"Welder, nearby",ct:"LEV extraction, RPE FFP3 — COSHH 2002"},{a:"Hot work",h:"Fire/explosion",w:"All",ct:"Permit, fire watch 60min — RRFSO 2005"}],"Excavation":[{a:"Dig",h:"Trench collapse/burial",w:"Workers",ct:"Shore >1.2m, daily inspection — CDM 2015"},{a:"Dig",h:"Services strike (gas/elec)",w:"Workers, public",ct:"CAT & Genny PAS128 — HSG47"},{a:"Open pit",h:"Falls into excavation",w:"All",ct:"Barriers, fencing, signage"}],"Roadworks":[{a:"Traffic",h:"Vehicle strike",w:"Workers",ct:"Chapter 8 TM, hi-vis Class 3, IPV"},{a:"Plant",h:"Moving plant strike",w:"Workers",ct:"Banksman, cameras, exclusion zones"}]};
const CTRL_S={fall:["Guard rails and toe boards","Full body harness EN 361","Safety netting","Rescue plan — WAHR 2005"],electric:["Lockout/tagout procedure","RCD 30mA protection","110V supply","Tested dead — EAWR 1989"],fire:["Hot work permit issued","Fire watch 60 min after","Extinguisher within reach","Combustibles cleared 10m — RRFSO 2005"],noise:["Hearing protection zone","Ear defenders >85dB","Exposure limits — CNWR 2005"],dust:["Water suppression","RPE FFP3 for silica","LEV extraction — COSHH 2002/EH40"],manual:["Mechanical aids","Team lift >25kg","Training — MHOR 1992"],vehicle:["Banksman stationed","Reversing cameras","Exclusion zones","Hi-vis Class 3"],collapse:["Shoring for >1.2m","Battering to safe angle","Daily inspection — CDM 2015"],chemical:["COSHH assessment","RPE per SDS","Chemical gloves EN374","Spill kit — COSHH 2002"],confined:["Permit to enter","4-gas monitor","Standby person","Rescue equipment — CSR 1997"]};
const suggestCtrls=h=>{if(!h)return[];const l=h.toLowerCase();const m=[];const kw={fall:["height","fall","scaffold","roof","ladder"],electric:["electr","shock","cable","wire"],fire:["fire","burn","weld","hot","spark"],noise:["noise","loud","hearing"],dust:["dust","silica","inhal"],manual:["manual","lift","handling","heavy"],vehicle:["vehicle","traffic","struck","plant"],collapse:["collapse","trench","excavat","burial"],chemical:["chemical","substance","hazardous","cement"],confined:["confined","manhole","tank","sewer"]};Object.entries(kw).forEach(([k,ws])=>{if(ws.some(w=>l.includes(w))&&CTRL_S[k])m.push(...CTRL_S[k])});return[...new Set(m)]};
const TBT={"General":[{t:"Manual Handling",d:"Assess load, mech aids, bend knees, team lift >25kg. MHOR 1992."},{t:"Slips Trips Falls",d:"Walkways clear, report spills, footwear, lighting. #1 UK injury."},{t:"PPE Usage",d:"Correct PPE for task, inspect before use, report damage. PPER 2022."},{t:"Fire Safety",d:"Assembly point, extinguisher, exits. Never block exits. RRFSO 2005."},{t:"First Aid",d:"Know first aiders, kit locations. Report ALL injuries. RIDDOR for 7+ day."}],"Welding":[{t:"Hot Work Safety",d:"Permit required. Clear 10m. Fire watch 60min. Extinguisher within reach."},{t:"Fume Control",d:"LEV extraction. FFP3 for stainless/galv. COSHH 2002 assessment."}],"Height":[{t:"Work at Height",d:"Ground first? Collective before personal protection. Rescue plan. WAHR 2005."},{t:"Ladder Safety",d:"SHORT duration, light work. 1:4 ratio, secured. 3 points contact."}],"Excavation":[{t:"Excavation Safety",d:"Never enter unsupported >1.2m. CAT & Genny. Barriers. HSG47."},{t:"Underground Services",d:"Scan PAS128. Service drawings. Hand dig 500mm. Report strikes."}]};
const CK_TPL={"Pre-Start Daily":[{cat:"Site",items:["Site secure","Signage displayed","Access clear","Lighting OK"]},{cat:"Welfare",items:["Toilets clean","Drinking water","Rest area clean"]},{cat:"Safety",items:["First aid kit","Fire extinguishers","Assembly point signed","Emergency contacts"]},{cat:"Works",items:["RAMS on site","Permits valid","Exclusion zones","Plant checks done","PPE available"]}],"Weekly Inspection":[{cat:"Access",items:["Routes clear","Fire exits clear","Emergency lighting","Signage OK"]},{cat:"Scaffold",items:["Inspected (7 day)","Tags current","Guard rails","Toe boards","Base plates"]},{cat:"Excavations",items:["Protected","Barriers OK","Stop blocks","Daily inspections"]},{cat:"Housekeeping",items:["Tidy","Materials stored","Waste segregated","No trip hazards"]},{cat:"Welfare",items:["Toilets OK","Water available","First aid stocked"]}],"Scaffold Pre-Use":[{cat:"Check",items:["Inspection tag <7 days","Guard rails all sides","Mid-rails fitted","Toe boards","Platform boarded","No gaps >25mm","Ties adequate","Base plates on boards","Access ladder secured","Ladder extends 1m above"]}],"MEWP Pre-Use":[{cat:"Check",items:["LOLER exam in date","Operator has IPAF","Controls function","Emergency lowering works","Guardrails secure","No hydraulic leaks","Outriggers function","Ground conditions OK","Overhead checked","Rescue plan"]}],"Excavation Daily":[{cat:"Check",items:["Competent person inspecting","No collapse signs","Shoring adequate","Edge protection","Barriers & signage","No water ingress","Services protected","Stop blocks","Access adequate","Rescue equipment"]}]};
const REG_T={coshh:{l:"COSHH",i:"☠️",c:"#ef4444"},scaffold:{l:"Scaffold",i:"🪜",c:"#78716c"},lifting:{l:"Lifting (LOLER)",i:"🏋️",c:"#14b8a6"},fire:{l:"Fire Log",i:"🔥",c:"#ef4444"},waste:{l:"Waste",i:"♻️",c:"#22c55e"},visitor:{l:"Visitors",i:"🧑‍💼",c:"#3b82f6"},drawing:{l:"Drawings",i:"📐",c:"#8b5cf6"}};

/* ═══ BLANKS ═══ */
const bH=()=>({id:uid(),a:"",h:"",w:"",cB:"",lB:2,sB:2,cA:"",lA:1,sA:1});
const bSt=n=>({id:uid(),n,d:"",r:""});
const bProj=()=>({id:uid(),cr:td(),up:td(),nm:"",ref:"",addr:"",postcode:"",w3w:"",client:"",pc:"",cdm:false,sd:td(),ed:"",sm:"",ss:"",ae:"",ap:"",ec:"",lat:null,lng:null,siteHours:"Mon-Fri 08:00-17:00",parking:"",siteRules:"",planImg:null,markers:[],accessNotes:""});
const bWorker=()=>({id:uid(),cr:td(),nm:"",role:"",company:"",phone:"",cscsNo:"",cscsType:"",emergContact:"",emergPhone:"",certs:[],notes:""});
const bCert=()=>({id:uid(),type:"",number:"",issued:"",expiry:""});
const bPhoto=pid=>({id:uid(),pid,cr:td(),data:null,desc:"",lat:null,lng:null});
const bEquip=pid=>({id:uid(),pid,cr:td(),nm:"",type:"",serial:"",inspDate:"",inspNext:"",calibDate:"",calibNext:"",status:"OK",defects:""});
const bVehicle=()=>({id:uid(),cr:td(),reg:"",make:"",model:"",type:"Van",motExpiry:"",insExpiry:"",taxExpiry:"",serviceNext:"",driver:"",driverId:"",defects:"",notes:""});
const bInd=(pid,wid)=>({id:uid(),pid,wid,date:td(),items:{"Site rules":false,"Fire evacuation":false,"First aid":false,"PPE requirements":false,"Hazard reporting":false,"Welfare facilities":false,"Emergency procedures":false,"RAMS briefing":false,"Permit system":false,"Environmental":false,"Working hours":false,"Accident reporting":false}});
const bRAMS=(pid,tr="General Construction")=>({id:uid(),pid,dt:"rams",st:"draft",cr:td(),up:td(),tr,no:"",pb:"",rb:"",ab:"",rev:"01",wd:"",wl:"",sd:td(),ed:"",wh:"08:00–17:00",hazards:[bH()],steps:[bSt(1)],ppe:AUTO_PPE[tr]||AUTO_PPE["General Construction"]||[],equip:[],workers:[],ep:"Emergency: 1)Make safe 2)Call 999 3)First aid 4)Evacuate 5)Report",coshh:"",photos:[],notes:"",sigs:[]});
const bPerm=(pid,pt)=>({id:uid(),pid,dt:pt,st:"draft",cr:td(),up:td(),no:"",loc:"",ib:"",vF:nw(),vT:"",desc:"",haz:"",ctrl:"",fw:"",combCl:false,eqType:"",mxH:"",rescue:"",spDesc:"",standby:"",circId:"",volt:"",testDead:false,mxDep:"",shore:"",svcId:false,catG:false,liftRef:"",loadW:"",crane:"",clBy:"",clDate:"",areaSafe:false,workers:[],photos:[],notes:"",sigs:[]});
const bSR=pid=>({id:uid(),pid,dt:"sitereport",st:"draft",cr:td(),up:td(),no:"",date:td(),weather:"",pCount:"",wDone:"",issues:"",hs:"",nearM:"",photos:[],by:"",notes:"",sigs:[]});
const bDR=pid=>({id:uid(),pid,dt:"dayreport",st:"draft",cr:td(),up:td(),date:td(),shift:"Day",wc:"",so:"",photos:[],by:"",notes:"",sigs:[]});
const bInst=pid=>({id:uid(),pid,dt:"instruction",st:"draft",cr:td(),up:td(),no:"",ib:"",it:"",date:td(),subj:"",desc:"",action:"",photos:[],notes:"",sigs:[]});
const bInc=pid=>({id:uid(),pid,dt:"incident",st:"draft",cr:td(),up:td(),no:"",date:td(),time:"",type:"Near Miss",loc:"",desc:"",injured:"",witness:"",immAction:"",rootCause:"",corrAction:"",corrBy:"",corrDate:"",reportedBy:"",riddor:false,photos:[],notes:"",sigs:[]});
const bSnag=pid=>({id:uid(),pid,dt:"snag",st:"draft",cr:td(),up:td(),no:"",loc:"",desc:"",priority:"Medium",status:"Open",assignedTo:"",dueDate:"",resolvedDate:"",resolvedBy:"",resolution:"",cost:"",photos:[],notes:""});
const bRfi=pid=>({id:uid(),pid,dt:"rfi",st:"draft",cr:td(),up:td(),no:"",from:"",to:"",date:td(),subject:"",question:"",context:"",drawingRef:"",responseRequired:td(),response:"",responseDate:"",respondedBy:"",status:"Open",cost:"",notes:""});
const bCoshh=pid=>({id:uid(),pid,cr:td(),substance:"",manufacturer:"",sdsRef:"",hazardType:"",controls:"",ppe:"",monitoring:"",emergAction:"",storage:""});
const bScaff=pid=>({id:uid(),pid,cr:td(),location:"",type:"",height:"",erectedBy:"",lastInsp:td(),inspBy:"",nextInsp:"",status:"OK"});
const bLift=pid=>({id:uid(),pid,cr:td(),item:"",serial:"",swl:"",lastExam:"",examBy:"",nextExam:"",certRef:"",status:"OK"});
const bFire=pid=>({id:uid(),pid,cr:td(),type:"Alarm Test",date:td(),performedBy:"",result:"Pass"});
const bWaste=pid=>({id:uid(),pid,cr:td(),date:td(),wasteType:"",ewcCode:"",quantity:"",carrier:"",wtnRef:"",hazardous:false});
const bVisitor=pid=>({id:uid(),pid,date:td(),name:"",company:"",host:"",timeIn:"",timeOut:"",inducted:false});
const bDrawing=pid=>({id:uid(),pid,cr:td(),drawingNo:"",title:"",revision:"A",date:td(),author:"",status:"For Information",discipline:"",scale:""});

/* ═══ COMPLIANCE CALC ═══ */
const calcComp=(p,docs,wkr)=>{const pd=docs.filter(d=>d.pid===p.id);if(!pd.length)return{score:0,items:[]};const items=[];let t=0,pass=0;
const ap=pd.filter(d=>d.st==="approved").length;const ds=pd.length?Math.round(ap/pd.length*100):0;items.push({l:"Docs Approved",v:`${ap}/${pd.length}`,p:ds,c:ds>=80?"#22c55e":ds>=50?"#eab308":"#ef4444"});t+=100;pass+=ds;
const hr=pd.some(d=>d.dt==="rams");items.push({l:"RAMS Created",v:hr?"Yes":"No",p:hr?100:0,c:hr?"#22c55e":"#ef4444"});t+=100;pass+=hr?100:0;
const he=!!p.ae&&!!p.ec&&!!p.ap;items.push({l:"Emergency Info",v:he?"Complete":"Missing",p:he?100:0,c:he?"#22c55e":"#ef4444"});t+=100;pass+=he?100:0;
const cv=wkr.length?Math.round(wkr.filter(w=>w.certs.every(c=>!c.expiry||dTo(c.expiry)>0)).length/wkr.length*100):100;items.push({l:"Certs Valid",v:`${cv}%`,p:cv,c:cv>=80?"#22c55e":cv>=50?"#eab308":"#ef4444"});t+=100;pass+=cv;
const pm=pd.filter(d=>d.dt?.startsWith("permit_")&&d.st==="approved");const vp=pm.filter(d=>!d.vT||new Date(d.vT)>new Date()).length;const pp=pm.length?Math.round(vp/pm.length*100):100;items.push({l:"Permits Valid",v:pm.length?`${vp}/${pm.length}`:"N/A",p:pp,c:pp>=80?"#22c55e":"#ef4444"});t+=100;pass+=pp;
return{score:t?Math.round(pass/t*100):0,items}};

/* ═══ PDF EXPORT ═══ */
function exportPDF(doc,proj,org,wkrs=[]){const dt=DT[doc.dt]||{l:"Doc",c:"#333"};const pc=org.primaryColor||"#f97316";const aw=(doc.workers||[]).map(id=>wkrs.find(w=>w.id===id)).filter(Boolean);
const logo=org.logo?`<img src="${org.logo}" style="max-height:45px"/>`:`<div style="font-size:18px;font-weight:800;color:${pc}">${org.nm}</div>`;
let h=`<!DOCTYPE html><html><head><title>${dt.l} ${doc.no||""}</title><style>*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact}body{font-size:10.5px;line-height:1.5}@page{size:A4;margin:12mm 15mm}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid ${pc};padding-bottom:8px;margin-bottom:12px}.pg{page-break-after:always}table{width:100%;border-collapse:collapse;font-size:9.5px}th{background:${pc};color:#fff;padding:4px 6px;text-align:left}td{border:1px solid #ddd;padding:3px 6px}.rb{display:inline-block;padding:1px 7px;border-radius:3px;font-weight:700;font-size:9px;color:#fff}.fl{font-size:8px;color:#888;text-transform:uppercase}.fv{font-size:10.5px}.g{display:grid;grid-template-columns:1fr 1fr;gap:6px}.tag{display:inline-block;background:#f0f0f0;border:1px solid #ddd;border-radius:3px;padding:1px 5px;margin:1px;font-size:8.5px}.ft{text-align:center;font-size:7.5px;color:#999;margin-top:12px;border-top:1px solid #eee;padding-top:4px}.wc{background:#f8f8f8;border:1px solid #ddd;border-radius:4px;padding:5px 8px;margin-bottom:3px;font-size:9px}.cv{color:#16a34a;font-weight:600}.ce{color:#dc2626;font-weight:600}.stamp{display:inline-block;border:3px solid;border-radius:8px;padding:6px 20px;font-size:16px;font-weight:800;transform:rotate(-5deg);margin-top:30px;text-transform:uppercase}.s-approved{border-color:#16a34a;color:#16a34a}.s-draft{border-color:#6b7280;color:#6b7280}.s-pending{border-color:#ca8a04;color:#ca8a04}</style></head><body>`;
// Cover
h+=`<div class="pg" style="text-align:center;padding-top:80px"><div>${logo}</div>${org.addr?`<div style="font-size:10px;color:#aaa;margin-top:4px">${org.addr}</div>`:""}<div style="font-size:26px;font-weight:800;color:${pc};margin-top:50px">${dt.i||""} ${dt.l}</div>${doc.tr?`<div style="font-size:14px;color:#666;margin-top:8px">Trade: ${doc.tr}</div>`:""}<div style="font-size:14px;color:#666;margin-top:4px">${proj?.nm||"Project"}</div><div style="font-size:11px;color:#888;margin-top:8px">${doc.no||""} · Rev ${doc.rev||"01"} · ${fmt(doc.cr)}</div><div class="stamp s-${doc.st}">${ST[doc.st]?.ic||""} ${ST[doc.st]?.l||doc.st}</div><div style="margin-top:60px;font-size:10px;color:#999"><div>Site: ${proj?.addr||"—"} ${proj?.postcode||""}</div><div>Client: ${proj?.client||"—"}</div><div>Prepared: ${doc.pb||doc.by||doc.ib||"—"}</div></div></div>`;
// Content
h+=`<div class="pg"><div class="hdr"><div>${logo}</div><div style="text-align:right;font-size:9px;color:#666">${doc.no||""}<br/>Rev ${doc.rev||"01"}<br/>${fmt(doc.cr)}</div></div>`;
h+=`<div style="font-size:18px;font-weight:700;color:${pc};margin-bottom:4px">${dt.l}${doc.tr?` — ${doc.tr}`:""}</div>`;
h+=`<div style="font-size:10px;color:#666;margin-bottom:12px">Project: ${proj?.nm||"—"} | Site: ${proj?.addr||"—"} ${proj?.postcode||""}</div>`;
if(doc.dt==="rams"){
  h+=`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Scope of Work</div><div class="g"><div><div class="fl">Description</div><div class="fv">${doc.wd||"—"}</div></div><div><div class="fl">Location</div><div class="fv">${doc.wl||"—"}</div></div><div><div class="fl">Duration</div><div class="fv">${fmt(doc.sd)} to ${fmt(doc.ed)}</div></div><div><div class="fl">Hours</div><div class="fv">${doc.wh||"—"}</div></div></div></div>`;
  h+=`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Hazard Assessment</div><table><tr><th>#</th><th>Activity</th><th>Hazard</th><th>Who</th><th>Controls</th><th>Risk</th><th>Additional</th><th>Residual</th></tr>`;
  (doc.hazards||[]).forEach((hz,i)=>{const sb=(hz.lB+1)*(hz.sB+1),sa=(hz.lA+1)*(hz.sA+1);h+=`<tr><td>${i+1}</td><td>${hz.a||"—"}</td><td>${hz.h||"—"}</td><td>${hz.w||"—"}</td><td>${(hz.cB||"—").replace(/\n/g,"<br/>")}</td><td><span class="rb" style="background:${rBg(sb)}">${sb}</span></td><td>${(hz.cA||"—").replace(/\n/g,"<br/>")}</td><td><span class="rb" style="background:${rBg(sa)}">${sa}</span></td></tr>`});
  h+=`</table></div>`;
  h+=`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Method Statement</div><table><tr><th>Step</th><th>Description</th><th>By</th></tr>`;
  (doc.steps||[]).forEach((s,i)=>{h+=`<tr><td>${i+1}</td><td>${(s.d||"—").replace(/\n/g,"<br/>")}</td><td>${s.r||"—"}</td></tr>`});h+=`</table></div>`;
  h+=`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">PPE Requirements (PPER 2022)</div>`;
  (doc.ppe||[]).forEach(p=>{h+=`<span class="tag">✓ ${p}</span> `});h+=`</div>`;
  h+=`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Emergency</div><div class="fv">${(doc.ep||"—").replace(/\n/g,"<br/>")}</div><div class="g" style="margin-top:6px"><div><div class="fl">Nearest A&E</div><div class="fv" style="color:#dc2626;font-weight:700">${proj?.ae||"—"}</div></div><div><div class="fl">Assembly Point</div><div class="fv" style="color:#2563eb;font-weight:700">${proj?.ap||"—"}</div></div></div></div>`;
  if(aw.length){h+=`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Workers & Competency</div>`;aw.forEach(w=>{h+=`<div class="wc"><strong>${w.nm}</strong> — ${w.role||"—"} · ${w.company||"—"}${w.cscsNo?` · CSCS: ${w.cscsNo}`:""}<br/>`;w.certs.filter(c=>!c.expiry||dTo(c.expiry)>0).forEach(c=>{h+=`<span class="cv">✓ ${c.type}</span> `});w.certs.filter(c=>c.expiry&&dTo(c.expiry)<=0).forEach(c=>{h+=`<span class="ce">✕ ${c.type} EXPIRED</span> `});h+=`</div>`});h+=`</div>`}
}else{Object.entries(doc).filter(([k,v])=>!["id","pid","dt","st","cr","up","no","rev","sigs","photos","workers","hazards","steps","ppe","equip"].includes(k)&&v&&typeof v==="string").forEach(([k,v])=>{h+=`<div style="margin-bottom:4px"><div class="fl">${k.replace(/([A-Z])/g," $1")}</div><div class="fv">${v.replace(/\n/g,"<br/>")}</div></div>`})}
// Sigs
h+=`<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;color:${pc};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Signatures</div><div style="font-size:9px;color:#666;margin-bottom:6px">I confirm I have read, understood and will comply with this document.</div><table><tr><th>Name</th><th>Role</th><th>Date</th><th>Signature</th></tr>`;
(doc.sigs||[]).forEach(s=>{h+=`<tr><td>${s.nm||""}</td><td>${s.rl||""}</td><td>${fmt(s.dt)}</td><td style="height:28px"></td></tr>`});for(let i=0;i<Math.max(0,5-(doc.sigs||[]).length);i++)h+=`<tr><td style="height:28px"></td><td></td><td></td><td></td></tr>`;
h+=`</table></div><div class="ft">${org.nm} · ${doc.no||""} · Rev ${doc.rev||"01"} · ${fmt(doc.cr)} · RAMS Pro · UK H&S Compliant</div></div></body></html>`;
const w=window.open("","_blank");if(w){w.document.write(h);w.document.close();setTimeout(()=>w.print(),500)}else alert("Allow pop-ups for PDF export")}

/* ═══ SHARED UI ═══ */
function Sc({t,i,children,T,op=true,badge}){const[o,setO]=useState(op);return<div style={{background:T.c,borderRadius:6,marginBottom:5,overflow:"hidden"}}><button onClick={()=>setO(!o)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"none",border:"none",color:T.f,fontSize:11,fontWeight:600,cursor:"pointer"}}><span>{i} {t}{badge?<span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#f97316",color:"#fff",marginLeft:4}}>{badge}</span>:""}</span><span style={{transform:o?"rotate(180deg)":"",transition:".2s",fontSize:9}}>▼</span></button>{o&&<div style={{padding:"0 10px 10px"}}>{children}</div>}</div>}
function Fl({l,r,children}){return<div style={{marginBottom:8}}><label style={{display:"block",fontSize:9,color:"#94a3b8",marginBottom:2,fontWeight:500}}>{l}{r&&<span style={{color:"#f97316"}}> *</span>}</label>{children}</div>}
function Inp({v,o,t="text",p="",T}){return<input style={{width:"100%",background:T.c2,border:`1px solid ${T.b}`,borderRadius:4,padding:"5px 7px",color:T.f,fontSize:10}} type={t} value={v||""} onChange={e=>o(e.target.value)} placeholder={p}/>}
function Txa({v,o,r=3,p="",T}){return<textarea style={{width:"100%",background:T.c2,border:`1px solid ${T.b}`,borderRadius:4,padding:"5px 7px",color:T.f,fontSize:10,minHeight:r*22,resize:"vertical"}} value={v||""} onChange={e=>o(e.target.value)} placeholder={p}/>}
function Sel({v,o,opts,T}){return<select style={{width:"100%",background:T.c2,border:`1px solid ${T.b}`,borderRadius:4,padding:"5px 7px",color:T.f,fontSize:10}} value={v||""} onChange={e=>o(e.target.value)}>{opts.map(x=>typeof x==="string"?<option key={x}>{x}</option>:<option key={x.v} value={x.v}>{x.l}</option>)}</select>}
function CB({p,T}){return<div style={{height:4,background:T.b,borderRadius:2,overflow:"hidden",marginTop:3}}><div style={{height:"100%",width:`${p}%`,background:p>=80?"#22c55e":p>=50?"#eab308":"#ef4444",borderRadius:2,transition:"width .3s"}}/></div>}
function Btn({children,c="#f97316",onClick}){return<button onClick={onClick} style={{background:c,border:"none",borderRadius:4,padding:"5px 10px",color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer"}}>{children}</button>}
function Bk({T,onClick}){return<button onClick={onClick} style={{background:"none",border:`1px solid ${T.b}`,color:T.m,borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>←</button>}
function Sigs({sg,o,T}){return<Sc t="Signatures" i="✍️" T={T} op={false}>{(sg||[]).map((x,i)=><div key={i} style={{display:"flex",gap:4,marginBottom:4,flexWrap:"wrap"}}><input style={{flex:1,minWidth:70,background:T.c2,border:`1px solid ${T.b}`,borderRadius:3,padding:"4px 6px",color:T.f,fontSize:10}} value={x.nm||""} onChange={e=>{const n=[...sg];n[i]={...n[i],nm:e.target.value};o(n)}} placeholder="Name"/><input style={{flex:1,minWidth:60,background:T.c2,border:`1px solid ${T.b}`,borderRadius:3,padding:"4px 6px",color:T.f,fontSize:10}} value={x.rl||""} onChange={e=>{const n=[...sg];n[i]={...n[i],rl:e.target.value};o(n)}} placeholder="Role"/><input type="date" style={{width:105,background:T.c2,border:`1px solid ${T.b}`,borderRadius:3,padding:"4px",color:T.f,fontSize:10}} value={x.dt||""} onChange={e=>{const n=[...sg];n[i]={...n[i],dt:e.target.value};o(n)}}/><button onClick={()=>o(sg.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button></div>)}<Btn c="#1e40af" onClick={()=>o([...(sg||[]),{nm:"",rl:"",dt:td()}])}>+ Signature</Btn></Sc>}
function RiskMx({l,s,onChange,label}){return<div style={{marginBottom:8}}>{label&&<div style={{fontSize:9,fontWeight:600,color:"#94a3b8",marginBottom:3}}>{label}</div>}<div style={{display:"inline-grid",gridTemplateColumns:"auto repeat(5,1fr)",gap:1,fontSize:8}}><div/>{["Neg","Minor","7Day","Major","Fatal"].map((x,i)=><div key={i} style={{textAlign:"center",color:"#64748b",padding:"1px 2px",minWidth:30}}>{x}</div>)}{[4,3,2,1,0].map(li=><>{<div key={`l${li}`} style={{display:"flex",alignItems:"center",padding:"0 2px",color:"#64748b",fontSize:7}}>{["V.Unlikely","Unlikely","Possible","Likely","V.Likely"][li]}</div>}{[0,1,2,3,4].map(si=>{const sc=(li+1)*(si+1);const sel=li===l&&si===s;return<button key={`${li}${si}`} onClick={()=>onChange(li,si)} style={{width:30,height:22,border:sel?"2px solid #fff":"1px solid #0004",borderRadius:3,background:rBg(sc),color:"#fff",fontSize:9,fontWeight:sel?800:600,cursor:"pointer",opacity:sel?1:.6}}>{sc}</button>})}</>)}</div><div style={{marginTop:3}}><span style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:600,background:RC[rlv((l+1)*(s+1))],color:"#fff"}}>{(l+1)*(s+1)} — {rlv((l+1)*(s+1))==="low"?"Low":rlv((l+1)*(s+1))==="med"?"Medium":rlv((l+1)*(s+1))==="high"?"High":"CRITICAL"}</span></div></div>}
function TrainMx({wkr,T}){const ac=[...new Set(wkr.flatMap(w=>w.certs.map(c=>c.type)).filter(Boolean))];if(!wkr.length||!ac.length)return<div style={{padding:16,textAlign:"center",color:T.m,fontSize:11}}>Add workers with certs first</div>;return<div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",fontSize:9,minWidth:ac.length*50+120}}><thead><tr><th style={{background:T.c,color:T.f,padding:"4px 6px",textAlign:"left",position:"sticky",left:0,zIndex:1,borderBottom:`2px solid ${T.b}`}}>Worker</th>{ac.map(c=><th key={c} style={{background:T.c,color:T.f,padding:"3px 2px",textAlign:"center",borderBottom:`2px solid ${T.b}`,writingMode:"vertical-lr",height:70,fontSize:7}}>{c}</th>)}</tr></thead><tbody>{wkr.map(w=><tr key={w.id}><td style={{padding:"3px 6px",borderBottom:`1px solid ${T.b}`,fontWeight:600,color:T.f,position:"sticky",left:0,background:T.bg,whiteSpace:"nowrap"}}>{w.nm}</td>{ac.map(c=>{const ct=w.certs.find(x=>x.type===c);const d=ct?dTo(ct.expiry):null;return<td key={c} style={{textAlign:"center",padding:2,borderBottom:`1px solid ${T.b}`}}>{!ct?<span style={{color:T.b}}>—</span>:d===null||d===999?<span style={{color:"#22c55e",fontWeight:700}}>✓</span>:d<=0?<span style={{background:"#7f1d1d",color:"#fca5a5",padding:"1px 3px",borderRadius:2,fontWeight:700,fontSize:8}}>✕</span>:d<=30?<span style={{background:"#713f12",color:"#fde68a",padding:"1px 3px",borderRadius:2,fontSize:8}}>{d}d</span>:<span style={{color:"#22c55e",fontWeight:700}}>✓</span>}</td>})}</tr>)}</tbody></table></div>}

/* ═══ THEMES ═══ */
const DK={bg:"#0b1121",f:"#e2e8f0",c:"#111827",c2:"#0f172a",b:"#1e293b",m:"#64748b"};
const LI={bg:"#f8fafc",f:"#0f172a",c:"#ffffff",c2:"#f1f5f9",b:"#e2e8f0",m:"#64748b"};

/* ═══════════════ MAIN APP ═══════════════ */
export default function App(){
const[th,setTh]=useState(()=>{try{return localStorage.getItem("rXth")||"dark"}catch{return"dark"}});
const T=th==="dark"?DK:LI;
const[tab,setTab]=useState("dash");const[prj,setPrj]=useState([]);const[docs,setDocs]=useState([]);const[wkr,setWkr]=useState([]);const[pho,setPho]=useState([]);const[equ,setEqu]=useState([]);const[veh,setVeh]=useState([]);const[ind,setInd]=useState([]);
const[regs,setRegs]=useState({coshh:[],scaffold:[],lifting:[],fire:[],waste:[],visitor:[],drawing:[]});
const[chk,setChk]=useState([]);
const[org,setOrg]=useState({nm:"FESS - Food Engineering Services",addr:"",ph:"",em:"",logo:null,primaryColor:"#f97316",safetyPolicy:""});
const[sp,setSp]=useState(null);const[ed,setEd]=useState(null);const[sub,setSub]=useState(null);const[ld,setLd]=useState(false);const[search,setSearch]=useState(false);

useEffect(()=>{try{[["rXp",setPrj],["rXd",setDocs],["rXw",setWkr],["rXph",setPho],["rXo",setOrg],["rXeq",setEqu],["rXin",setInd],["rXv",setVeh],["rXrg",setRegs],["rXck",setChk]].forEach(([k,s])=>{const v=localStorage.getItem(k);if(v)s(JSON.parse(v))});setLd(true)}catch{setLd(true)}},[]);
useEffect(()=>{if(ld){try{localStorage.setItem("rXp",JSON.stringify(prj));localStorage.setItem("rXd",JSON.stringify(docs));localStorage.setItem("rXw",JSON.stringify(wkr));localStorage.setItem("rXph",JSON.stringify(pho));localStorage.setItem("rXo",JSON.stringify(org));localStorage.setItem("rXeq",JSON.stringify(equ));localStorage.setItem("rXin",JSON.stringify(ind));localStorage.setItem("rXv",JSON.stringify(veh));localStorage.setItem("rXrg",JSON.stringify(regs));localStorage.setItem("rXck",JSON.stringify(chk));localStorage.setItem("rXth",th)}catch{}}},[prj,docs,wkr,pho,org,equ,ind,veh,regs,chk,th,ld]);

const svD=doc=>{doc.up=td();setDocs(p=>{const i=p.findIndex(x=>x.id===doc.id);return i>=0?p.map((x,j)=>j===i?doc:x):[...p,doc]});setEd(doc)};
const delD=id=>{if(confirm("Delete?")){setDocs(p=>p.filter(x=>x.id!==id));setEd(null);setSub(null)}};
const dupD=doc=>{const n=JSON.parse(JSON.stringify(doc));n.id=uid();n.cr=td();n.up=td();n.st="draft";n.no="";setDocs(p=>[...p,n]);setEd(n)};
const newD=(pid,dt)=>{const pre=dt==="rams"?"RAMS-":dt==="instruction"?"SI-":dt==="sitereport"?"SR-":dt==="dayreport"?"DR-":dt==="incident"?"INC-":dt==="snag"?"SN-":dt==="rfi"?"RFI-":"PTW-";let d;if(dt==="rams")d=bRAMS(pid);else if(dt==="instruction")d=bInst(pid);else if(dt==="sitereport")d=bSR(pid);else if(dt==="dayreport")d=bDR(pid);else if(dt==="incident")d=bInc(pid);else if(dt==="snag")d=bSnag(pid);else if(dt==="rfi")d=bRfi(pid);else d=bPerm(pid,dt);d.no=nextNo(docs.filter(x=>x.pid===pid),pre);setDocs(p=>[...p,d]);setEd(d);setSub("docedit")};
const newP=()=>{const p=bProj();setPrj(v=>[...v,p]);setSp(p);setSub("projedit")};
const svP=p=>{p.up=td();setPrj(v=>v.map(x=>x.id===p.id?p:x));setSp(p)};
const delP=id=>{if(confirm("Delete all?")){setPrj(p=>p.filter(x=>x.id!==id));setDocs(p=>p.filter(x=>x.pid!==id));setPho(p=>p.filter(x=>x.pid!==id));setEqu(p=>p.filter(x=>x.pid!==id));setSp(null);setSub(null)}};
const pD=sp?docs.filter(d=>d.pid===sp.id).sort((a,b)=>b.up.localeCompare(a.up)):[];
const expC=wkr.flatMap(w=>w.certs.filter(c=>c.expiry&&dTo(c.expiry)<=30).map(c=>({...c,wn:w.nm})));

/* ═══ GLOBAL SEARCH ═══ */
const Search=()=>{const[q,setQ]=useState("");const ref=useRef();useEffect(()=>{ref.current?.focus()},[]);
const res=[];if(q.length>=2){const s=q.toLowerCase();prj.filter(p=>(p.nm+p.addr+p.client).toLowerCase().includes(s)).forEach(p=>res.push({t:"📂",l:p.nm,s:p.addr,act:()=>{setSp(p);setSub(null);setSearch(false)}}));docs.filter(d=>((d.loc||"")+(d.subj||"")+(d.wl||"")+(d.desc||"")+(d.no||"")+(d.question||"")).toLowerCase().includes(s)).forEach(d=>{const dt=DT[d.dt]||{i:"📄",l:"Doc"};res.push({t:dt.i,l:`${d.no||""} ${d.loc||d.subj||d.wl||d.question?.slice(0,30)||""}`,s:dt.l,act:()=>{const p=prj.find(x=>x.id===d.pid);if(p){setSp(p);setEd(d);setSub("docedit")}setSearch(false)}})});wkr.filter(w=>(w.nm+w.role).toLowerCase().includes(s)).forEach(w=>res.push({t:"👷",l:w.nm,s:w.role,act:()=>setSearch(false)}))}
return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",justifyContent:"center",paddingTop:50}} onClick={()=>setSearch(false)}><div style={{width:"90%",maxWidth:500,maxHeight:"70vh",background:T.c,borderRadius:12,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}} onClick={e=>e.stopPropagation()}><div style={{padding:12,borderBottom:`1px solid ${T.b}`}}><input ref={ref} style={{width:"100%",background:T.c2,border:`1px solid ${T.b}`,borderRadius:8,padding:"10px",color:T.f,fontSize:14}} value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Search projects, docs, workers..."/></div><div style={{maxHeight:"55vh",overflowY:"auto",padding:8}}>{res.length===0&&q.length>=2&&<div style={{textAlign:"center",padding:16,color:T.m}}>No results</div>}{res.slice(0,15).map((r,i)=><button key={i} onClick={r.act} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"6px 8px",borderRadius:4,cursor:"pointer",marginBottom:2}}><div style={{fontSize:11,fontWeight:600,color:T.f}}>{r.t} {r.l}</div><div style={{fontSize:9,color:T.m}}>{r.s}</div></button>)}</div></div></div>};

return<div style={{maxWidth:800,margin:"0 auto",minHeight:"100vh",background:T.bg,color:T.f,fontFamily:"'DM Sans',sans-serif"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:${T.bg};font-family:'DM Sans',sans-serif}input,textarea,select,button{font-family:inherit}input:focus,textarea:focus,select:focus{outline:2px solid #f97316;outline-offset:-1px}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${T.b};border-radius:3px}.fi{animation:fi .2s ease forwards}@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:600px){.g2{grid-template-columns:1fr}}`}</style>

{search&&<Search/>}

{/* HEADER */}
<header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:T.c,borderBottom:`1px solid ${T.b}`,position:"sticky",top:0,zIndex:50}}>
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    {org.logo?<img src={org.logo} style={{height:22,borderRadius:3}} alt=""/>:<span style={{fontSize:15,fontWeight:700,color:org.primaryColor||"#f97316"}}>⚙️ RAMS Pro</span>}
    {sp&&<span style={{fontSize:9,color:T.m,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {sp.nm}</span>}
  </div>
  <div style={{display:"flex",gap:4,alignItems:"center"}}>
    <button onClick={()=>setSearch(true)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer"}}>🔍</button>
    {expC.length>0&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:3,background:"#7f1d1d",color:"#fca5a5"}}>⚠️{expC.length}</span>}
    <button onClick={()=>setTh(th==="dark"?"light":"dark")} style={{background:"none",border:"none",fontSize:14,cursor:"pointer"}}>{th==="dark"?"☀️":"🌙"}</button>
    {sp&&<button onClick={()=>{setSp(null);setSub(null);setEd(null);setTab("dash")}} style={{background:T.b,color:T.m,border:"none",borderRadius:4,padding:"3px 6px",fontSize:9,cursor:"pointer"}}>Home</button>}
  </div>
</header>

<main style={{padding:10,paddingBottom:70}}>

{/* ═══ DASHBOARD ═══ */}
{!sp&&!sub&&tab==="dash"&&<div className="fi">
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
    <div><div style={{fontSize:18,fontWeight:700,color:T.f}}>Dashboard</div><div style={{fontSize:10,color:T.m}}>{org.nm}</div></div>
    <Btn onClick={newP}>+ Project</Btn>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:4,marginBottom:8}}>
    {[["📂",prj.length,"Projects","#60a5fa"],["📄",docs.length,"Docs","#f97316"],["⚠️",docs.filter(d=>d.dt==="rams").length,"RAMS","#f97316"],["📝",docs.filter(d=>d.dt?.startsWith("permit_")).length,"Permits","#a78bfa"],["🚨",docs.filter(d=>d.dt==="incident").length,"Incidents","#ef4444"],["🐛",docs.filter(d=>d.dt==="snag").length,"Snags","#f59e0b"],["👷",wkr.length,"Workers","#06b6d4"],["🚗",veh.length,"Vehicles","#10b981"]].map(([i,v,l,c],idx)=>
      <div key={idx} style={{background:T.c,borderRadius:6,padding:"6px 4px",borderLeft:`3px solid ${c}`,textAlign:"center"}}><div style={{fontSize:16,fontWeight:700,color:T.f}}>{v}</div><div style={{fontSize:7,color:T.m}}>{l}</div></div>)}
  </div>
  {docs.length>0&&<div style={{display:"flex",gap:2,height:18,borderRadius:3,overflow:"hidden",marginBottom:8}}>
    {docs.filter(d=>d.st==="approved").length>0&&<div style={{flex:docs.filter(d=>d.st==="approved").length,background:"#22c55e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontWeight:600}}>{docs.filter(d=>d.st==="approved").length}✅</div>}
    {docs.filter(d=>d.st==="pending").length>0&&<div style={{flex:docs.filter(d=>d.st==="pending").length,background:"#eab308",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#000",fontWeight:600}}>{docs.filter(d=>d.st==="pending").length}⏳</div>}
    {docs.filter(d=>d.st==="draft").length>0&&<div style={{flex:docs.filter(d=>d.st==="draft").length,background:T.b,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:T.m}}>{docs.filter(d=>d.st==="draft").length}📝</div>}
  </div>}
  {expC.length>0&&<div style={{background:"#7f1d1d",borderRadius:6,padding:8,marginBottom:6}}><div style={{fontSize:10,fontWeight:600,color:"#fca5a5"}}>⚠️ Certificate Alerts</div>{expC.slice(0,4).map((c,i)=><div key={i} style={{fontSize:9,color:"#fde68a"}}>{c.wn}: {c.type} — {dTo(c.expiry)<=0?"EXPIRED":`${dTo(c.expiry)}d`}</div>)}</div>}
  {prj.sort((a,b)=>b.up.localeCompare(a.up)).map(p=>{const dc=docs.filter(d=>d.pid===p.id);const pct=dc.length?Math.round(dc.reduce((a,d)=>a+docPct(d),0)/dc.length):0;
    return<button key={p.id} onClick={()=>{setSp(p);setSub(null)}} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${T.b}`,borderRadius:6,padding:10,marginBottom:4,cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:12,fontWeight:600,color:T.f}}>{p.nm||"Untitled"}</div><div style={{fontSize:10,color:T.m}}>{p.client||"—"}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:pct>=80?"#22c55e":pct>=50?"#eab308":"#ef4444"}}>{pct}%</div><div style={{fontSize:8,color:T.m}}>{dc.length} docs</div></div></div><CB p={pct} T={T}/>
    </button>})}
</div>}

{/* ═══ WORKERS TAB ═══ */}
{!sp&&!sub&&tab==="workers"&&<Workers wkr={wkr} setWkr={setWkr} T={T}/>}

{/* ═══ VEHICLES TAB ═══ */}
{!sp&&!sub&&tab==="vehicles"&&<Vehicles veh={veh} setVeh={setVeh} wkr={wkr} T={T}/>}

{/* ═══ MATRIX TAB ═══ */}
{!sp&&!sub&&tab==="matrix"&&<div className="fi"><h2 style={{fontSize:16,fontWeight:700,color:T.f,marginBottom:8}}>📊 Training Matrix</h2><TrainMx wkr={wkr} T={T}/></div>}

{/* ═══ SETTINGS TAB ═══ */}
{!sp&&!sub&&tab==="more"&&<div className="fi">
  <h2 style={{fontSize:16,fontWeight:700,color:T.f,marginBottom:8}}>⚙️ Settings</h2>
  <Sc t="Organisation & Branding" i="🏢" T={T}>
    <Fl l="Name" r><Inp v={org.nm} o={v=>setOrg(p=>({...p,nm:v}))} T={T}/></Fl>
    <Fl l="Address"><Txa v={org.addr} o={v=>setOrg(p=>({...p,addr:v}))} r={2} T={T}/></Fl>
    <div className="g2"><Fl l="Phone"><Inp v={org.ph} o={v=>setOrg(p=>({...p,ph:v}))} T={T}/></Fl><Fl l="Email"><Inp v={org.em} o={v=>setOrg(p=>({...p,em:v}))} T={T}/></Fl></div>
    <Fl l="Logo"><input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>setOrg(p=>({...p,logo:ev.target.result}));r.readAsDataURL(f)}} style={{fontSize:10,color:T.f}}/></Fl>
    {org.logo&&<div style={{marginBottom:6}}><img src={org.logo} style={{maxHeight:40,borderRadius:4}} alt=""/><button onClick={()=>setOrg(p=>({...p,logo:null}))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10,marginLeft:6}}>✕</button></div>}
    <Fl l="Brand Colour"><input type="color" value={org.primaryColor||"#f97316"} onChange={e=>setOrg(p=>({...p,primaryColor:e.target.value}))} style={{width:50,height:28,border:"none",cursor:"pointer"}}/></Fl>
  </Sc>
  <Sc t="Theme" i="🎨" T={T}><div style={{display:"flex",gap:8}}><button onClick={()=>setTh("dark")} style={{flex:1,padding:10,borderRadius:6,border:th==="dark"?"2px solid #f97316":`1px solid ${T.b}`,background:"#0b1121",color:"#e2e8f0",cursor:"pointer",fontSize:11}}>🌙 Dark</button><button onClick={()=>setTh("light")} style={{flex:1,padding:10,borderRadius:6,border:th==="light"?"2px solid #f97316":`1px solid ${T.b}`,background:"#f8fafc",color:"#0f172a",cursor:"pointer",fontSize:11}}>☀️ Light</button></div></Sc>
  <Sc t="Data" i="💾" T={T}><Btn c="#7f1d1d" onClick={()=>{if(confirm("Clear ALL?")){localStorage.clear();location.reload()}}}>🗑️ Reset All</Btn></Sc>
</div>}

{/* ═══ PROJECT VIEW ═══ */}
{sp&&!sub&&<ProjView sp={sp} pD={pD} T={T} org={org} wkr={wkr} docs={docs} onEdit={()=>setSub("projedit")} onDel={()=>delP(sp.id)} onBack={()=>{setSp(null);setTab("dash")}} onNewD={newD} onOpenD={d=>{setEd(d);setSub("docedit")}} setSub={setSub}/>}

{/* SUB PAGES */}
{sp&&sub==="projedit"&&<ProjEdit p={sp} sv={svP} T={T} bk={()=>setSub(null)} dl={()=>delP(sp.id)}/>}
{sp&&sub==="docedit"&&ed&&<DocEd doc={ed} p={sp} org={org} T={T} sv={svD} dl={delD} dp={dupD} bk={()=>{setEd(null);setSub(null)}} wkr={wkr}/>}
{sp&&sub==="siteplan"&&<SitePlan p={sp} sv={svP} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="photos"&&<Photos proj={sp} pho={pho.filter(x=>x.pid===sp.id)} addPh={ph=>setPho(p=>[...p,ph])} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="equip"&&<EquipPg proj={sp} equ={equ.filter(x=>x.pid===sp.id)} setEqu={setEqu} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="toolbox"&&<ToolboxPg T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="inductions"&&<IndPg proj={sp} wkr={wkr} ind={ind.filter(x=>x.pid===sp.id)} setInd={setInd} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="registers"&&<RegPg proj={sp} regs={regs} setRegs={setRegs} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="checklists"&&<ChkPg proj={sp} chk={chk.filter(x=>x.pid===sp.id)} setChk={setChk} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="permits"&&<PermDash docs={pD} T={T} bk={()=>setSub(null)} onOD={d=>{setEd(d);setSub("docedit")}}/>}
{sp&&sub==="weather"&&<WeatherPg p={sp} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="timeline"&&<TimelinePg docs={pD} pho={pho.filter(x=>x.pid===sp.id)} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="calendar"&&<CalendarPg docs={docs} wkr={wkr} equ={equ} T={T} bk={()=>setSub(null)}/>}
{sp&&sub==="matrix"&&<div className="fi"><Bk T={T} onClick={()=>setSub(null)}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>📊 Training Matrix</h3><TrainMx wkr={wkr} T={T}/></div>}

</main>

{/* ═══ BOTTOM NAV — HOME ═══ */}
{!sp&&!sub&&<nav style={{position:"fixed",bottom:0,left:0,right:0,display:"flex",justifyContent:"center",background:T.c,borderTop:`1px solid ${T.b}`,padding:"4px 0",zIndex:50}}>
  <div style={{display:"flex",maxWidth:600,width:"100%",justifyContent:"space-around"}}>
    {[["dash","📊","Home"],["workers","👷","Workers"],["vehicles","🚗","Vehicles"],["matrix","📊","Matrix"],["more","⚙️","Settings"]].map(([k,i,l])=>
      <button key={k} onClick={()=>setTab(k)} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:1,cursor:"pointer",padding:"2px 8px",color:tab===k?"#f97316":T.m}}>
        <span style={{fontSize:14}}>{i}</span><span style={{fontSize:7,fontWeight:tab===k?600:400}}>{l}</span>
      </button>)}
  </div>
</nav>}

{/* ═══ BOTTOM NAV — PROJECT ═══ */}
{sp&&!sub&&<nav style={{position:"fixed",bottom:0,left:0,right:0,background:T.c,borderTop:`1px solid ${T.b}`,padding:"3px 0",zIndex:50}}>
  <div style={{display:"flex",maxWidth:700,margin:"0 auto",justifyContent:"space-around"}}>
    {[["docs","📄","Docs",null],["siteplan","🗺️","Plan"],["photos","📸","Photos"],["permits","🎫","Permits"],["equip","🔧","Equip"],["toolbox","🗣️","Talks"],["inductions","🪪","Induct"],["registers","📚","Regs"],["checklists","✅","Checks"],["weather","🌤️","Wx"],["timeline","📰","Log"],["calendar","📅","Cal"],["matrix","📊","Mx"]].map(([k,i,l])=>
      <button key={k} onClick={()=>k==="docs"?setSub(null):setSub(k)} style={{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",padding:"1px 3px",color:sub===k||(k==="docs"&&!sub)?"#f97316":T.m}}>
        <span style={{fontSize:12}}>{i}</span><span style={{fontSize:5,fontWeight:sub===k?600:400}}>{l}</span>
      </button>)}
  </div>
</nav>}

</div>}

/* ═══════ PROJECT VIEW ═══════ */
function ProjView({sp,pD,T,org,wkr,docs,onEdit,onDel,onBack,onNewD,onOpenD,setSub}){
  const[ft,setFt]=useState("all");
  const fl=pD.filter(d=>ft==="all"||d.dt===ft||(ft==="permit"&&d.dt?.startsWith("permit_")));
  const comp=calcComp(sp,docs,wkr);
  return<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><Bk T={T} onClick={onBack}/><div style={{display:"flex",gap:3}}><button onClick={onEdit} style={{background:"none",border:"none",cursor:"pointer",fontSize:12}}>✏️</button><button onClick={onDel} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:12}}>🗑️</button></div></div>
    <div style={{background:T.c,borderRadius:8,padding:12,marginBottom:6,borderLeft:`3px solid ${org.primaryColor||"#f97316"}`}}>
      {org.logo&&<img src={org.logo} style={{maxHeight:20,marginBottom:4}} alt=""/>}
      <div style={{fontSize:14,fontWeight:700,color:T.f}}>{sp.nm||"Untitled"}</div>
      <div style={{fontSize:10,color:T.m}}>{sp.client} · {sp.addr} {sp.postcode}</div>
      {sp.cdm&&<div style={{fontSize:9,color:"#f97316",fontWeight:600}}>⚠️ CDM Notifiable</div>}
    </div>
    {/* Compliance */}
    <div style={{background:T.c,borderRadius:8,padding:10,marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:T.f}}>📊 Compliance</span><span style={{fontSize:20,fontWeight:800,color:comp.score>=80?"#22c55e":comp.score>=50?"#eab308":"#ef4444"}}>{comp.score}%</span></div>
      <div style={{height:6,background:T.b,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${comp.score}%`,background:comp.score>=80?"#22c55e":comp.score>=50?"#eab308":"#ef4444",transition:"width .5s"}}/></div>
      <div style={{marginTop:4}}>{comp.items.map((it,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:9,padding:"2px 0"}}><span style={{color:T.f}}>{it.l}</span><span style={{fontWeight:600,color:it.c}}>{it.v}</span></div>)}</div>
    </div>
    {/* Quick Create */}
    <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:6}}>
      {[["rams","⚠️ RAMS","#f97316"],["incident","🚨 Incident","#ef4444"],["snag","🐛 Snag","#f59e0b"],["rfi","❓ RFI","#7c3aed"],["sitereport","📋 Report","#10b981"],["dayreport","📅 Day","#06b6d4"],["instruction","📌","#8b5cf6"],["permit_hotwork","🔥","#ef4444"],["permit_height","🏗️","#3b82f6"],["permit_confined","⛑️","#a855f7"],["permit_electrical","⚡","#eab308"],["permit_excavation","⛏️","#78716c"],["permit_lifting","🏋️","#14b8a6"],["permit_general","📝","#64748b"]].map(([t,l,c])=>
        <Btn key={t} c={c} onClick={()=>onNewD(sp.id,t)}>{l}</Btn>)}
    </div>
    {/* Filter */}
    <div style={{display:"flex",gap:3,marginBottom:4,flexWrap:"wrap"}}>{[["all","All"],["rams","RAMS"],["permit","Permits"],["incident","Incidents"],["snag","Snags"],["rfi","RFIs"],["sitereport","Reports"]].map(([k,l])=><button key={k} onClick={()=>setFt(k)} style={{background:ft===k?"#f97316":T.b,color:ft===k?"#fff":T.m,border:"none",borderRadius:3,padding:"3px 7px",fontSize:9,cursor:"pointer"}}>{l}</button>)}</div>
    {/* Doc List */}
    {fl.map(d=>{const dt=DT[d.dt]||{l:"Doc",i:"📄",c:"#64748b"};const pct=docPct(d);
      return<button key={d.id} onClick={()=>onOpenD(d)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${T.b}`,borderRadius:6,padding:8,marginBottom:3,cursor:"pointer",borderLeft:`3px solid ${dt.c}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1}}><div style={{fontSize:10,color:dt.c,fontWeight:600}}>{dt.i} {dt.l}{d.tr?` · ${d.tr}`:""}</div>
            <div style={{fontSize:11,fontWeight:600,color:T.f}}>{d.loc||d.subj||d.wl||d.question?.slice(0,40)||d.desc?.slice(0,40)||d.no||"—"}</div>
            <div style={{fontSize:9,color:T.m}}>{d.no} · {fmt(d.up)}</div></div>
          <div style={{textAlign:"right",minWidth:40}}><span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:ST[d.st]?.bg,color:ST[d.st]?.fg}}>{ST[d.st]?.ic}</span><div style={{fontSize:12,fontWeight:700,color:pct>=80?"#22c55e":pct>=50?"#eab308":"#ef4444"}}>{pct}%</div></div>
        </div><CB p={pct} T={T}/>
      </button>})}
  </div>;
}

/* ═══ PROJECT EDIT ═══ */
function ProjEdit({p,sv,T,bk,dl}){return<div className="fi"><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Bk T={T} onClick={bk}/><button onClick={dl} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑️</button></div>
  <Sc t="Project (CDM 2015)" i="📂" T={T}><div className="g2"><Fl l="Name" r><Inp v={p.nm} o={v=>sv({...p,nm:v})} T={T}/></Fl><Fl l="Ref"><Inp v={p.ref} o={v=>sv({...p,ref:v})} T={T}/></Fl></div><Fl l="Address" r><Inp v={p.addr} o={v=>sv({...p,addr:v})} T={T}/></Fl><div className="g2"><Fl l="Postcode"><Inp v={p.postcode} o={v=>sv({...p,postcode:v})} T={T}/></Fl><Fl l="what3words"><Inp v={p.w3w} o={v=>sv({...p,w3w:v})} T={T} p="///word.word.word"/></Fl></div><div className="g2"><Fl l="Client"><Inp v={p.client} o={v=>sv({...p,client:v})} T={T}/></Fl><Fl l="PC"><Inp v={p.pc} o={v=>sv({...p,pc:v})} T={T}/></Fl></div><div className="g2"><Fl l="Start"><Inp v={p.sd} o={v=>sv({...p,sd:v})} t="date" T={T}/></Fl><Fl l="End"><Inp v={p.ed} o={v=>sv({...p,ed:v})} t="date" T={T}/></Fl></div><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={p.cdm} onChange={e=>sv({...p,cdm:e.target.checked})} style={{accentColor:"#f97316"}}/>CDM Notifiable</label></Sc>
  <Sc t="Emergency (auto-fills)" i="🚨" T={T}><div className="g2"><Fl l="Nearest A&E"><Inp v={p.ae} o={v=>sv({...p,ae:v})} T={T}/></Fl><Fl l="Emergency Tel"><Inp v={p.ec} o={v=>sv({...p,ec:v})} T={T}/></Fl><Fl l="Assembly Point"><Inp v={p.ap} o={v=>sv({...p,ap:v})} T={T}/></Fl></div></Sc>
  <Sc t="Site Details" i="📍" T={T}><Fl l="Hours"><Inp v={p.siteHours} o={v=>sv({...p,siteHours:v})} T={T}/></Fl><Fl l="Parking"><Txa v={p.parking} o={v=>sv({...p,parking:v})} r={2} T={T}/></Fl><Fl l="Access"><Txa v={p.accessNotes} o={v=>sv({...p,accessNotes:v})} r={2} T={T}/></Fl><Fl l="Site Rules"><Txa v={p.siteRules} o={v=>sv({...p,siteRules:v})} r={2} T={T}/></Fl>{p.postcode&&<Btn c="#065f46" onClick={()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.addr+" "+p.postcode)}`)}>🗺️ Maps</Btn>}</Sc>
</div>}

/* ═══ DOC EDITOR — includes ALL doc types ═══ */
function DocEd({doc,p,org,T,sv,dl,dp,bk,wkr}){
  const[d,setD]=useState(doc);useEffect(()=>setD(doc),[doc.id]);
  const u=(k,v)=>{const n={...d,[k]:v};setD(n);sv(n)};
  const dt=DT[d.dt]||{l:"Doc",i:"📄",c:"#64748b"};const pct=docPct(d);

  return<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:4}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}><Bk T={T} onClick={bk}/><span style={{fontSize:12,fontWeight:600,color:dt.c}}>{dt.i} {dt.l}</span><span style={{fontSize:9,color:T.m}}>{d.no}</span></div>
      <div style={{display:"flex",gap:3,alignItems:"center"}}>
        <Btn c="#1e40af" onClick={()=>exportPDF(d,p,org,wkr)}>🖨️</Btn>
        <select value={d.st} onChange={e=>u("st",e.target.value)} style={{background:ST[d.st]?.bg,color:ST[d.st]?.fg,border:"none",borderRadius:4,padding:"3px 6px",fontSize:9}}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.ic} {v.l}</option>)}</select>
        <button onClick={()=>dp(d)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12}}>📋</button>
        <button onClick={()=>dl(d.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:12}}>🗑️</button>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><div style={{flex:1}}><CB p={pct} T={T}/></div><span style={{fontSize:10,fontWeight:600,color:pct>=80?"#22c55e":pct>=50?"#eab308":"#ef4444"}}>{pct}%</span></div>
    <div style={{display:"flex",gap:2,marginBottom:6}}>{["draft","pending","approved","closed"].map((s,i)=><div key={s} style={{flex:1,height:4,borderRadius:2,background:["draft","pending","approved","closed"].indexOf(d.st)>=i?(s==="approved"?"#22c55e":s==="pending"?"#eab308":s==="closed"?"#3b82f6":T.b):T.b}}/>)}</div>

    {/* Banner */}
    <div style={{background:T.c,borderRadius:7,padding:10,marginBottom:6,borderLeft:`3px solid ${dt.c}`}}>
      {org.logo?<img src={org.logo} style={{maxHeight:20,marginBottom:3}} alt=""/>:<div style={{fontSize:11,fontWeight:700,color:org.primaryColor||"#f97316"}}>{org.nm}</div>}
      <div style={{fontSize:13,fontWeight:700,color:T.f}}>{dt.l}{d.tr?` — ${d.tr}`:""}</div>
      <div style={{fontSize:9,color:T.m}}>Project: {p?.nm||"—"} | {d.no} | {fmt(d.cr)}</div>
    </div>

    {/* RAMS */}
    {d.dt==="rams"&&<>
      <Sc t="Trade & Scope" i="🔧" T={T}><Fl l="Trade"><Sel v={d.tr} o={v=>{u("tr",v);if(AUTO_PPE[v]&&confirm(`Auto-select PPE for ${v}?`))u("ppe",AUTO_PPE[v])}} opts={TRADES} T={T}/></Fl><Fl l="Description" r><Txa v={d.wd} o={v=>u("wd",v)} r={3} T={T}/></Fl><Fl l="Location"><Inp v={d.wl} o={v=>u("wl",v)} T={T}/></Fl><div className="g2"><Fl l="Start"><Inp v={d.sd} o={v=>u("sd",v)} t="date" T={T}/></Fl><Fl l="End"><Inp v={d.ed} o={v=>u("ed",v)} t="date" T={T}/></Fl></div></Sc>
      <Sc t="Personnel" i="👷" T={T}><div className="g2"><Fl l="Prepared By" r><Inp v={d.pb} o={v=>u("pb",v)} T={T}/></Fl><Fl l="Reviewed"><Inp v={d.rb} o={v=>u("rb",v)} T={T}/></Fl><Fl l="Approved"><Inp v={d.ab} o={v=>u("ab",v)} T={T}/></Fl></div></Sc>
      <Sc t={`Workers (${(d.workers||[]).length})`} i="👷" T={T}>{wkr.map(w=>{const sel=(d.workers||[]).includes(w.id);return<button key={w.id} onClick={()=>{const l=sel?(d.workers||[]).filter(x=>x!==w.id):[...(d.workers||[]),w.id];u("workers",l)}} style={{display:"block",width:"100%",padding:"4px 6px",borderRadius:3,border:"none",cursor:"pointer",background:sel?"#f9731622":"transparent",marginBottom:2,textAlign:"left"}}><span style={{fontSize:10,color:sel?"#f97316":T.m}}>{sel?"✓ ":""}{w.nm} — {w.role}</span></button>})}</Sc>
      <Sc t="Hazards & Risk" i="⚠️" T={T}>
        <div style={{display:"flex",gap:4,marginBottom:4}}><Btn c="#1e40af" onClick={()=>{const lib=HLIB[d.tr]||HLIB["General Construction"]||[];const nh=lib.map(x=>({...bH(),a:x.a,h:x.h,w:x.w,cB:x.ct,cA:x.ct}));if(nh.length)u("hazards",[...d.hazards.filter(h=>h.h),...nh])}}>📚 Load</Btn><Btn c="#065f46" onClick={()=>u("hazards",[...d.hazards,bH()])}>+ Add</Btn></div>
        {d.hazards.map((h,i)=>{const sug=suggestCtrls(h.h);return<div key={h.id} style={{background:T.c2,borderRadius:5,padding:8,marginBottom:5,border:`1px solid ${T.b}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,fontWeight:700,color:"#f97316"}}>#{i+1}</span>{d.hazards.length>1&&<button onClick={()=>u("hazards",d.hazards.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button>}</div>
          <Fl l="Activity"><Inp v={h.a} o={v=>{const hz=[...d.hazards];hz[i]={...hz[i],a:v};u("hazards",hz)}} T={T}/></Fl>
          <Fl l="Hazard" r><Inp v={h.h} o={v=>{const hz=[...d.hazards];hz[i]={...hz[i],h:v};u("hazards",hz)}} T={T}/></Fl>
          <Fl l="Who"><Inp v={h.w} o={v=>{const hz=[...d.hazards];hz[i]={...hz[i],w:v};u("hazards",hz)}} T={T}/></Fl>
          <Fl l="Controls"><Txa v={h.cB} o={v=>{const hz=[...d.hazards];hz[i]={...hz[i],cB:v};u("hazards",hz)}} r={2} T={T}/></Fl>
          {sug.length>0&&<div style={{marginBottom:4}}><div style={{fontSize:8,color:"#22c55e",fontWeight:600}}>💡 Suggestions:</div><div style={{display:"flex",flexWrap:"wrap",gap:2}}>{sug.map((s,j)=><button key={j} onClick={()=>{const hz=[...d.hazards];hz[i]={...hz[i],cB:(hz[i].cB?hz[i].cB+"\n":"")+s};u("hazards",hz)}} style={{padding:"2px 5px",borderRadius:3,border:"none",fontSize:7,cursor:"pointer",background:"#22c55e22",color:"#22c55e"}}>{s}</button>)}</div></div>}
          <RiskMx l={h.lB} s={h.sB} onChange={(l,s)=>{const hz=[...d.hazards];hz[i]={...hz[i],lB:l,sB:s};u("hazards",hz)}} label="INITIAL:"/>
          <Fl l="Additional Controls"><Txa v={h.cA} o={v=>{const hz=[...d.hazards];hz[i]={...hz[i],cA:v};u("hazards",hz)}} r={2} T={T}/></Fl>
          <RiskMx l={h.lA} s={h.sA} onChange={(l,s)=>{const hz=[...d.hazards];hz[i]={...hz[i],lA:l,sA:s};u("hazards",hz)}} label="RESIDUAL:"/>
        </div>})}
      </Sc>
      <Sc t="Method Statement" i="📝" T={T}>{d.steps.map((x,i)=><div key={x.id} style={{background:T.c2,borderRadius:4,padding:6,marginBottom:3,border:`1px solid ${T.b}`}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,fontWeight:600,color:"#3b82f6"}}>Step {i+1}</span>{d.steps.length>1&&<button onClick={()=>u("steps",d.steps.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button>}</div><Fl l="Description" r><Txa v={x.d} o={v=>{const s=[...d.steps];s[i]={...s[i],d:v};u("steps",s)}} r={2} T={T}/></Fl><Fl l="By"><Inp v={x.r} o={v=>{const s=[...d.steps];s[i]={...s[i],r:v};u("steps",s)}} T={T}/></Fl></div>)}<Btn c="#1e40af" onClick={()=>u("steps",[...d.steps,bSt(d.steps.length+1)])}>+ Step</Btn></Sc>
      <Sc t="PPE" i="🦺" T={T}><Btn c="#065f46" onClick={()=>u("ppe",AUTO_PPE[d.tr]||[])}>🔄 Reset to {d.tr}</Btn><div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:6}}>{PPE.map(x=><button key={x} onClick={()=>{const l=d.ppe.includes(x)?d.ppe.filter(y=>y!==x):[...d.ppe,x];u("ppe",l)}} style={{padding:"3px 7px",borderRadius:3,border:"none",fontSize:9,cursor:"pointer",background:d.ppe.includes(x)?"#f97316":T.b,color:d.ppe.includes(x)?"#fff":T.m}}>{d.ppe.includes(x)?"✓ ":""}{x}</button>)}</div></Sc>
      <Sc t="Equipment" i="🔧" T={T} op={false}><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{EQUIP.map(x=><button key={x} onClick={()=>{const l=(d.equip||[]).includes(x)?(d.equip||[]).filter(y=>y!==x):[...(d.equip||[]),x];u("equip",l)}} style={{padding:"3px 7px",borderRadius:3,border:"none",fontSize:9,cursor:"pointer",background:(d.equip||[]).includes(x)?"#3b82f6":T.b,color:(d.equip||[]).includes(x)?"#fff":T.m}}>{(d.equip||[]).includes(x)?"✓ ":""}{x}</button>)}</div></Sc>
      <Sc t="Emergency" i="🚨" T={T}><Fl l="Procedure"><Txa v={d.ep} o={v=>u("ep",v)} r={2} T={T}/></Fl><div style={{fontSize:9,color:"#22c55e"}}>A&E: {p?.ae||"—"} · Assembly: {p?.ap||"—"}</div></Sc>
    </>}

    {/* PERMITS */}
    {d.dt?.startsWith("permit_")&&<><Sc t="Permit" i="📋" T={T}><div className="g2"><Fl l="Location" r><Inp v={d.loc} o={v=>u("loc",v)} T={T}/></Fl><Fl l="Issued By" r><Inp v={d.ib} o={v=>u("ib",v)} T={T}/></Fl></div><div className="g2"><Fl l="From" r><Inp v={d.vF} o={v=>u("vF",v)} t="datetime-local" T={T}/></Fl><Fl l="Until" r><Inp v={d.vT} o={v=>u("vT",v)} t="datetime-local" T={T}/></Fl></div></Sc><Sc t="Work & Controls" i="⚠️" T={T}><Fl l="Description" r><Txa v={d.desc} o={v=>u("desc",v)} r={3} T={T}/></Fl><Fl l="Hazards"><Txa v={d.haz} o={v=>u("haz",v)} r={2} T={T}/></Fl><Fl l="Controls"><Txa v={d.ctrl} o={v=>u("ctrl",v)} r={2} T={T}/></Fl></Sc>
    {d.dt==="permit_hotwork"&&<Sc t="Hot Work" i="🔥" T={T}><Fl l="Fire Watcher"><Inp v={d.fw} o={v=>u("fw",v)} T={T}/></Fl><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={d.combCl} onChange={e=>u("combCl",e.target.checked)} style={{accentColor:"#22c55e"}}/>Combustibles cleared</label></Sc>}
    {d.dt==="permit_height"&&<Sc t="Height" i="🏗️" T={T}><div className="g2"><Fl l="Equipment"><Inp v={d.eqType} o={v=>u("eqType",v)} T={T}/></Fl><Fl l="Height"><Inp v={d.mxH} o={v=>u("mxH",v)} T={T}/></Fl></div><Fl l="Rescue"><Txa v={d.rescue} o={v=>u("rescue",v)} r={2} T={T}/></Fl></Sc>}
    {d.dt==="permit_confined"&&<Sc t="Confined" i="⛑️" T={T}><Fl l="Space"><Txa v={d.spDesc} o={v=>u("spDesc",v)} r={2} T={T}/></Fl><Fl l="Standby"><Inp v={d.standby} o={v=>u("standby",v)} T={T}/></Fl></Sc>}
    {d.dt==="permit_electrical"&&<Sc t="Electrical" i="⚡" T={T}><Fl l="Circuit"><Inp v={d.circId} o={v=>u("circId",v)} T={T}/></Fl><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={d.testDead} onChange={e=>u("testDead",e.target.checked)} style={{accentColor:"#22c55e"}}/>Tested dead</label></Sc>}
    {d.dt==="permit_excavation"&&<Sc t="Excavation" i="⛏️" T={T}><Fl l="Depth"><Inp v={d.mxDep} o={v=>u("mxDep",v)} T={T}/></Fl><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={d.catG} onChange={e=>u("catG",e.target.checked)} style={{accentColor:"#22c55e"}}/>CAT & Genny</label></Sc>}
    {d.dt==="permit_lifting"&&<Sc t="Lifting" i="🏋️" T={T}><Fl l="Lift Plan"><Inp v={d.liftRef} o={v=>u("liftRef",v)} T={T}/></Fl><Fl l="Weight"><Inp v={d.loadW} o={v=>u("loadW",v)} T={T}/></Fl></Sc>}
    <Sc t="Closure" i="🔒" T={T} op={false}><Fl l="Closed By"><Inp v={d.clBy} o={v=>u("clBy",v)} T={T}/></Fl><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={d.areaSafe} onChange={e=>u("areaSafe",e.target.checked)} style={{accentColor:"#22c55e"}}/>Area safe</label></Sc></>}

    {/* INCIDENT */}
    {d.dt==="incident"&&<><Sc t="Details" i="🚨" T={T}><div className="g2"><Fl l="Date"><Inp v={d.date} o={v=>u("date",v)} t="date" T={T}/></Fl><Fl l="Time"><Inp v={d.time} o={v=>u("time",v)} t="time" T={T}/></Fl></div><Fl l="Type" r><Sel v={d.type} o={v=>u("type",v)} opts={INC_T} T={T}/></Fl><Fl l="Location"><Inp v={d.loc} o={v=>u("loc",v)} T={T}/></Fl><Fl l="Description" r><Txa v={d.desc} o={v=>u("desc",v)} r={4} T={T}/></Fl><Fl l="Reported By" r><Inp v={d.reportedBy} o={v=>u("reportedBy",v)} T={T}/></Fl><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={d.riddor} onChange={e=>u("riddor",e.target.checked)} style={{accentColor:"#ef4444"}}/>RIDDOR</label></Sc><Sc t="Investigation" i="🔍" T={T}><Fl l="Immediate Actions"><Txa v={d.immAction} o={v=>u("immAction",v)} r={2} T={T}/></Fl><Fl l="Root Cause"><Txa v={d.rootCause} o={v=>u("rootCause",v)} r={2} T={T}/></Fl><Fl l="Corrective Actions"><Txa v={d.corrAction} o={v=>u("corrAction",v)} r={2} T={T}/></Fl></Sc></>}

    {/* SNAG */}
    {d.dt==="snag"&&<Sc t="Snag" i="🐛" T={T}><Fl l="Location" r><Inp v={d.loc} o={v=>u("loc",v)} T={T}/></Fl><Fl l="Description" r><Txa v={d.desc} o={v=>u("desc",v)} r={3} T={T}/></Fl><div className="g2"><Fl l="Priority"><Sel v={d.priority} o={v=>u("priority",v)} opts={["Low","Medium","High","Critical"]} T={T}/></Fl><Fl l="Status"><Sel v={d.status} o={v=>u("status",v)} opts={["Open","In Progress","Resolved","Closed"]} T={T}/></Fl></div><div className="g2"><Fl l="Assigned To"><Inp v={d.assignedTo} o={v=>u("assignedTo",v)} T={T}/></Fl><Fl l="Due Date"><Inp v={d.dueDate} o={v=>u("dueDate",v)} t="date" T={T}/></Fl></div><Fl l="Resolution"><Txa v={d.resolution} o={v=>u("resolution",v)} r={2} T={T}/></Fl><Fl l="Cost"><Inp v={d.cost} o={v=>u("cost",v)} T={T} p="£"/></Fl></Sc>}

    {/* RFI */}
    {d.dt==="rfi"&&<><Sc t="RFI" i="❓" T={T}><div className="g2"><Fl l="From" r><Inp v={d.from} o={v=>u("from",v)} T={T}/></Fl><Fl l="To" r><Inp v={d.to} o={v=>u("to",v)} T={T}/></Fl></div><Fl l="Subject"><Inp v={d.subject} o={v=>u("subject",v)} T={T}/></Fl><Fl l="Question" r><Txa v={d.question} o={v=>u("question",v)} r={4} T={T}/></Fl><Fl l="Drawing Ref"><Inp v={d.drawingRef} o={v=>u("drawingRef",v)} T={T}/></Fl><div className="g2"><Fl l="Response By"><Inp v={d.responseRequired} o={v=>u("responseRequired",v)} t="date" T={T}/></Fl><Fl l="Status"><Sel v={d.status} o={v=>u("status",v)} opts={["Open","Answered","Closed","Overdue"]} T={T}/></Fl></div><Fl l="Cost"><Inp v={d.cost} o={v=>u("cost",v)} T={T} p="£"/></Fl></Sc>
    <Sc t="Response" i="↩️" T={T} op={false}><Fl l="Response"><Txa v={d.response} o={v=>u("response",v)} r={3} T={T}/></Fl><div className="g2"><Fl l="By"><Inp v={d.respondedBy} o={v=>u("respondedBy",v)} T={T}/></Fl><Fl l="Date"><Inp v={d.responseDate} o={v=>u("responseDate",v)} t="date" T={T}/></Fl></div></Sc></>}

    {/* REPORTS */}
    {d.dt==="sitereport"&&<><Sc t="Details" i="📋" T={T}><div className="g2"><Fl l="Date"><Inp v={d.date} o={v=>u("date",v)} t="date" T={T}/></Fl><Fl l="Weather"><Inp v={d.weather} o={v=>u("weather",v)} T={T}/></Fl></div></Sc><Sc t="Progress" i="📐" T={T}><Fl l="Work Done" r><Txa v={d.wDone} o={v=>u("wDone",v)} r={3} T={T}/></Fl><Fl l="Issues"><Txa v={d.issues} o={v=>u("issues",v)} r={2} T={T}/></Fl></Sc><Sc t="H&S" i="⚠️" T={T}><Fl l="Notes"><Txa v={d.hs} o={v=>u("hs",v)} r={2} T={T}/></Fl><Fl l="Near Misses"><Txa v={d.nearM} o={v=>u("nearM",v)} r={2} T={T}/></Fl></Sc></>}
    {d.dt==="dayreport"&&<><Sc t="Shift" i="🕐" T={T}><div className="g2"><Fl l="Date"><Inp v={d.date} o={v=>u("date",v)} t="date" T={T}/></Fl><Fl l="Shift"><Sel v={d.shift} o={v=>u("shift",v)} opts={["Day","Night","Twilight"]} T={T}/></Fl></div></Sc><Sc t="Work" i="📐" T={T}><Fl l="Carried Out" r><Txa v={d.wc} o={v=>u("wc",v)} r={3} T={T}/></Fl></Sc></>}
    {d.dt==="instruction"&&<Sc t="Details" i="📌" T={T}><div className="g2"><Fl l="From" r><Inp v={d.ib} o={v=>u("ib",v)} T={T}/></Fl><Fl l="To" r><Inp v={d.it} o={v=>u("it",v)} T={T}/></Fl></div><Fl l="Subject" r><Inp v={d.subj} o={v=>u("subj",v)} T={T}/></Fl><Fl l="Description" r><Txa v={d.desc} o={v=>u("desc",v)} r={4} T={T}/></Fl><Fl l="Action"><Txa v={d.action} o={v=>u("action",v)} r={3} T={T}/></Fl></Sc>}

    <Fl l="Prepared By"><Inp v={d.by||d.pb||""} o={v=>u(d.dt==="rams"?"pb":"by",v)} T={T}/></Fl>
    <Sigs sg={d.sigs} o={v=>u("sigs",v)} T={T}/>
  </div>;
}

/* ═══ WORKERS ═══ */
function Workers({wkr,setWkr,T}){const[sel,setSel]=useState(null);const[sr,setSr]=useState("");
  if(sel){const u=(k,v)=>{const n={...sel,[k]:v};setSel(n);setWkr(p=>p.map(x=>x.id===n.id?n:x))};
    return<div className="fi"><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Bk T={T} onClick={()=>setSel(null)}/><button onClick={()=>{setWkr(p=>p.filter(x=>x.id!==sel.id));setSel(null)}} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑️</button></div>
    <Sc t="Personal" i="👤" T={T}><div className="g2"><Fl l="Name" r><Inp v={sel.nm} o={v=>u("nm",v)} T={T}/></Fl><Fl l="Role"><Inp v={sel.role} o={v=>u("role",v)} T={T}/></Fl></div><div className="g2"><Fl l="Company"><Inp v={sel.company} o={v=>u("company",v)} T={T}/></Fl><Fl l="Phone"><Inp v={sel.phone} o={v=>u("phone",v)} T={T} t="tel"/></Fl></div><div className="g2"><Fl l="CSCS No"><Inp v={sel.cscsNo} o={v=>u("cscsNo",v)} T={T}/></Fl><Fl l="CSCS Type"><Sel v={sel.cscsType} o={v=>u("cscsType",v)} opts={["—","Labourer (Green)","Skilled (Blue)","Advanced (Gold)","Supervisor (Gold)","Manager (Black)"]} T={T}/></Fl></div></Sc>
    <Sc t={`Certificates (${sel.certs?.length||0})`} i="📜" T={T}>{(sel.certs||[]).map((c,i)=>{const dd=dTo(c.expiry);const cl=!c.expiry?"#64748b":dd<=0?"#ef4444":dd<=30?"#eab308":"#22c55e";return<div key={c.id} style={{background:T.c2,borderRadius:4,padding:6,marginBottom:4,borderLeft:`3px solid ${cl}`,border:`1px solid ${T.b}`}}><Fl l="Type"><Sel v={c.type} o={v=>{const cs=[...sel.certs];cs[i]={...cs[i],type:v};u("certs",cs)}} opts={["—",...CERT_T]} T={T}/></Fl><div className="g2"><Fl l="Number"><Inp v={c.number} o={v=>{const cs=[...sel.certs];cs[i]={...cs[i],number:v};u("certs",cs)}} T={T}/></Fl><Fl l="Expiry"><Inp v={c.expiry} o={v=>{const cs=[...sel.certs];cs[i]={...cs[i],expiry:v};u("certs",cs)}} t="date" T={T}/></Fl></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:9,color:cl,fontWeight:600}}>{!c.expiry?"—":dd<=0?"❌ EXPIRED":dd<=30?`⚠️ ${dd}d`:`✓ ${dd}d`}</span><button onClick={()=>u("certs",sel.certs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>✕</button></div></div>})}<Btn c="#065f46" onClick={()=>u("certs",[...(sel.certs||[]),bCert()])}>+ Certificate</Btn></Sc>
    <Sc t="Emergency" i="🚨" T={T}><div className="g2"><Fl l="Contact"><Inp v={sel.emergContact} o={v=>u("emergContact",v)} T={T}/></Fl><Fl l="Phone"><Inp v={sel.emergPhone} o={v=>u("emergPhone",v)} T={T} t="tel"/></Fl></div></Sc></div>}
  const fl=wkr.filter(w=>!sr||(w.nm+w.role).toLowerCase().includes(sr.toLowerCase()));
  return<div className="fi"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><h2 style={{fontSize:16,fontWeight:700,color:T.f}}>👷 Workers</h2><Btn onClick={()=>{const w=bWorker();setWkr(p=>[...p,w]);setSel(w)}}>+ Add</Btn></div>
    <input style={{width:"100%",background:T.c,border:`1px solid ${T.b}`,borderRadius:5,padding:"7px 9px",color:T.f,fontSize:11,marginBottom:6}} placeholder="Search..." value={sr} onChange={e=>setSr(e.target.value)}/>
    {fl.map(w=>{const exp=w.certs.some(c=>c.expiry&&dTo(c.expiry)<=0);return<button key={w.id} onClick={()=>setSel(w)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${T.b}`,borderRadius:5,padding:8,marginBottom:3,cursor:"pointer",borderLeft:`3px solid ${exp?"#ef4444":"#22c55e"}`}}><div style={{fontSize:12,fontWeight:600,color:T.f}}>{w.nm||"Unnamed"}</div><div style={{fontSize:10,color:T.m}}>{w.role} · {w.company} · {w.certs.length} certs {exp?"❌":""}</div></button>})}</div>}

/* ═══ VEHICLES ═══ */
function Vehicles({veh,setVeh,wkr,T}){return<div className="fi"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><h2 style={{fontSize:16,fontWeight:700,color:T.f}}>🚗 Vehicles</h2><Btn onClick={()=>setVeh(p=>[...p,bVehicle()])}>+ Add</Btn></div>
  {veh.map((v,i)=>{const md=dTo(v.motExpiry);const id=dTo(v.insExpiry);const td2=dTo(v.taxExpiry);const w=Math.min(md,id,td2);const cl=w<=0?"#ef4444":w<=30?"#eab308":"#22c55e";
    return<div key={v.id} style={{background:T.c,borderRadius:5,padding:8,marginBottom:4,borderLeft:`3px solid ${cl}`,border:`1px solid ${T.b}`}}>
      <div className="g2"><Fl l="Registration" r><Inp v={v.reg} o={val=>{const n=[...veh];n[i]={...n[i],reg:val};setVeh(n)}} T={T}/></Fl><Fl l="Make/Model"><Inp v={`${v.make} ${v.model}`.trim()} o={val=>{const[mk,...md]=val.split(" ");const n=[...veh];n[i]={...n[i],make:mk||"",model:md.join(" ")};setVeh(n)}} T={T}/></Fl></div>
      <div className="g2"><Fl l="MOT Expiry"><Inp v={v.motExpiry} o={val=>{const n=[...veh];n[i]={...n[i],motExpiry:val};setVeh(n)}} t="date" T={T}/></Fl><Fl l="Insurance Expiry"><Inp v={v.insExpiry} o={val=>{const n=[...veh];n[i]={...n[i],insExpiry:val};setVeh(n)}} t="date" T={T}/></Fl></div>
      <div className="g2"><Fl l="Tax Expiry"><Inp v={v.taxExpiry} o={val=>{const n=[...veh];n[i]={...n[i],taxExpiry:val};setVeh(n)}} t="date" T={T}/></Fl><Fl l="Next Service"><Inp v={v.serviceNext} o={val=>{const n=[...veh];n[i]={...n[i],serviceNext:val};setVeh(n)}} t="date" T={T}/></Fl></div>
      <Fl l="Assigned Driver"><Sel v={v.driver} o={val=>{const n=[...veh];n[i]={...n[i],driver:val};setVeh(n)}} opts={["—",...wkr.map(w=>w.nm)]} T={T}/></Fl>
      <Fl l="Defects/Notes"><Txa v={v.defects} o={val=>{const n=[...veh];n[i]={...n[i],defects:val};setVeh(n)}} r={2} T={T}/></Fl>
      <div style={{display:"flex",gap:6,fontSize:9,flexWrap:"wrap",marginBottom:4}}>
        <span style={{color:md<=0?"#ef4444":md<=30?"#eab308":"#22c55e",fontWeight:600}}>MOT:{md<=0?"❌":md<=30?`⚠️${md}d`:`✓${md}d`}</span>
        <span style={{color:id<=0?"#ef4444":id<=30?"#eab308":"#22c55e",fontWeight:600}}>Ins:{id<=0?"❌":id<=30?`⚠️${id}d`:`✓${id}d`}</span>
        <span style={{color:td2<=0?"#ef4444":td2<=30?"#eab308":"#22c55e",fontWeight:600}}>Tax:{td2<=0?"❌":td2<=30?`⚠️${td2}d`:`✓${td2}d`}</span>
      </div>
      <button onClick={()=>setVeh(veh.filter(x=>x.id!==v.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button>
    </div>})}</div>}

/* ═══ SITE PLAN ═══ */
function SitePlan({p,sv,T,bk}){const[placing,setPlacing]=useState(null);const cRef=useRef();
  const hUp=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>sv({...p,planImg:ev.target.result});r.readAsDataURL(f)};
  const hClick=e=>{if(!placing||!cRef.current)return;const rect=cRef.current.getBoundingClientRect();const x=((e.clientX-rect.left)/rect.width)*100;const y=((e.clientY-rect.top)/rect.height)*100;sv({...p,markers:[...(p.markers||[]),{id:uid(),type:placing,x,y}]});setPlacing(null)};
  return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>🗺️ Site Plan</h3>
    {!p.planImg?<div style={{textAlign:"center",padding:20,border:`2px dashed ${T.b}`,borderRadius:8}}><p style={{fontSize:11,color:T.m,marginBottom:8}}>Upload site plan/drawing</p><label style={{background:"#f97316",borderRadius:6,padding:"10px 20px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>📁 Upload<input type="file" accept="image/*" onChange={hUp} style={{display:"none"}}/></label></div>:
    <div>
      <div style={{fontSize:10,color:placing?"#22c55e":T.m,marginBottom:4}}>{placing?`Tap plan to place ${MARKERS.find(m=>m.t===placing)?.l}`:"Select marker:"}</div>
      {!placing&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>{MARKERS.map(m=><button key={m.t} onClick={()=>setPlacing(m.t)} style={{padding:"3px 6px",borderRadius:3,border:"none",fontSize:8,cursor:"pointer",background:m.c+"22",color:m.c,fontWeight:600}}>{m.i} {m.l}</button>)}</div>}
      {placing&&<Btn c="#7f1d1d" onClick={()=>setPlacing(null)}>Cancel</Btn>}
      <div ref={cRef} onClick={hClick} style={{position:"relative",borderRadius:8,overflow:"hidden",border:`2px solid ${placing?"#22c55e":T.b}`,cursor:placing?"crosshair":"default",marginTop:4}}>
        <img src={p.planImg} style={{width:"100%",display:"block"}}/>
        {(p.markers||[]).map(mk=>{const mt=MARKERS.find(m=>m.t===mk.type);return<div key={mk.id} style={{position:"absolute",left:`${mk.x}%`,top:`${mk.y}%`,transform:"translate(-50%,-50%)",fontSize:18,cursor:"pointer",filter:"drop-shadow(0 2px 4px rgba(0,0,0,.5))"}} onClick={e=>{e.stopPropagation();if(confirm(`Remove ${mt?.l}?`))sv({...p,markers:(p.markers||[]).filter(m=>m.id!==mk.id)})}}>{mt?.i||"📌"}</div>})}
      </div>
      <div style={{display:"flex",gap:4,marginTop:4}}><label style={{background:"#3b82f6",borderRadius:4,padding:"5px 10px",color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer"}}>Replace<input type="file" accept="image/*" onChange={hUp} style={{display:"none"}}/></label><Btn c="#7f1d1d" onClick={()=>{if(confirm("Remove?"))sv({...p,planImg:null,markers:[]})}}>🗑️</Btn></div>
    </div>}
    {(p.markers||[]).length>0&&<div style={{marginTop:8}}><div style={{fontSize:11,fontWeight:600,color:T.f,marginBottom:3}}>Legend ({(p.markers||[]).length})</div>{(p.markers||[]).map(mk=>{const mt=MARKERS.find(m=>m.t===mk.type);return<div key={mk.id} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 0"}}><span>{mt?.i}</span><span style={{fontSize:10,color:mt?.c,fontWeight:600}}>{mt?.l}</span></div>})}</div>}
  </div>}

/* ═══ PHOTOS ═══ */
function Photos({proj,pho,addPh,T,bk}){const[cap,setCap]=useState(false);const fR=useRef();const[desc,setDesc]=useState("");const[gps,setGps]=useState(null);
  const getG=()=>{if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>setGps({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{},{enableHighAccuracy:true})};
  const hF=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const ph=bPhoto(proj.id);ph.data=ev.target.result;ph.desc=desc;if(gps){ph.lat=gps.lat;ph.lng=gps.lng}addPh(ph);setCap(false);setDesc("")};r.readAsDataURL(f)};
  if(cap)return<div className="fi"><Bk T={T} onClick={()=>setCap(false)}/><div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:6,marginBottom:4}}>{PHOTO_D.map(d=><button key={d} onClick={()=>setDesc(d)} style={{padding:"3px 5px",borderRadius:3,border:"none",fontSize:8,cursor:"pointer",background:desc===d?"#f97316":T.b,color:desc===d?"#fff":T.m}}>{d}</button>)}</div><Inp v={desc} o={setDesc} p="Custom..." T={T}/><div style={{display:"flex",gap:6,marginTop:6}}><button onClick={()=>fR.current?.click()} style={{flex:1,background:"#f97316",border:"none",borderRadius:6,padding:12,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>📸 Camera</button><input ref={fR} type="file" accept="image/*" capture="environment" onChange={hF} style={{display:"none"}}/><button onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=hF;i.click()}} style={{flex:1,background:"#3b82f6",border:"none",borderRadius:6,padding:12,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>📁 Gallery</button></div></div>;
  return<div className="fi"><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Bk T={T} onClick={bk}/><Btn onClick={()=>{getG();setCap(true)}}>📸 Capture</Btn></div>
    {pho.length===0&&<div style={{textAlign:"center",padding:16,color:T.m}}>No photos</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:4}}>{pho.map(ph=><div key={ph.id} style={{background:T.c,borderRadius:4,overflow:"hidden",border:`1px solid ${T.b}`}}>{ph.data&&<img src={ph.data} style={{width:"100%",height:65,objectFit:"cover"}}/>}<div style={{padding:2}}><div style={{fontSize:7,fontWeight:600,color:T.f}}>{ph.desc?.slice(0,25)||"—"}</div>{ph.lat&&<div style={{fontSize:6,color:T.m}}>📍</div>}</div></div>)}</div></div>}

/* ═══ EQUIPMENT ═══ */
function EquipPg({proj,equ,setEqu,T,bk}){return<div className="fi"><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Bk T={T} onClick={bk}/><Btn onClick={()=>setEqu(p=>[...p,bEquip(proj.id)])}>+ Add</Btn></div><h3 style={{fontSize:14,fontWeight:700,color:T.f,marginBottom:6}}>🔧 Equipment</h3>
  {equ.map((eq,i)=>{const d=dTo(eq.inspNext);const cd=dTo(eq.calibNext);const cl=Math.min(d,cd)<=0?"#ef4444":Math.min(d,cd)<=14?"#eab308":"#22c55e";
    return<div key={eq.id} style={{background:T.c,borderRadius:5,padding:8,marginBottom:4,borderLeft:`3px solid ${cl}`,border:`1px solid ${T.b}`}}>
      <div className="g2"><Fl l="Name"><Inp v={eq.nm} o={v=>{const n=[...equ];n[i]={...n[i],nm:v};setEqu(n)}} T={T}/></Fl><Fl l="Serial"><Inp v={eq.serial} o={v=>{const n=[...equ];n[i]={...n[i],serial:v};setEqu(n)}} T={T}/></Fl></div>
      <div className="g2"><Fl l="Insp Date"><Inp v={eq.inspDate} o={v=>{const n=[...equ];n[i]={...n[i],inspDate:v};setEqu(n)}} t="date" T={T}/></Fl><Fl l="Insp Next"><Inp v={eq.inspNext} o={v=>{const n=[...equ];n[i]={...n[i],inspNext:v};setEqu(n)}} t="date" T={T}/></Fl></div>
      <div className="g2"><Fl l="Calib Date"><Inp v={eq.calibDate} o={v=>{const n=[...equ];n[i]={...n[i],calibDate:v};setEqu(n)}} t="date" T={T}/></Fl><Fl l="Calib Next"><Inp v={eq.calibNext} o={v=>{const n=[...equ];n[i]={...n[i],calibNext:v};setEqu(n)}} t="date" T={T}/></Fl></div>
      <Fl l="Status"><Sel v={eq.status} o={v=>{const n=[...equ];n[i]={...n[i],status:v};setEqu(n)}} opts={["OK","Defective","Out of Service","Calibration Due"]} T={T}/></Fl>
      <Fl l="Defects"><Txa v={eq.defects} o={v=>{const n=[...equ];n[i]={...n[i],defects:v};setEqu(n)}} r={2} T={T}/></Fl>
      <button onClick={()=>setEqu(equ.filter(x=>x.id!==eq.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button>
    </div>})}</div>}

/* ═══ TOOLBOX TALKS ═══ */
function ToolboxPg({T,bk}){const[sel,setSel]=useState(null);return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>🗣️ Toolbox Talks</h3>
  {Object.entries(TBT).map(([cat,talks])=><div key={cat} style={{marginBottom:6}}><div style={{fontSize:11,fontWeight:600,color:"#f97316",marginBottom:3}}>{cat}</div>
    {talks.map((t,i)=><button key={i} onClick={()=>setSel(sel?.t===t.t?null:t)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${sel?.t===t.t?"#f97316":T.b}`,borderRadius:5,padding:8,marginBottom:3,cursor:"pointer"}}><div style={{fontSize:11,fontWeight:600,color:T.f}}>{t.t}</div>{sel?.t===t.t&&<div style={{fontSize:10,color:T.m,marginTop:4,lineHeight:1.5}}>{t.d}</div>}</button>)}</div>)}</div>}

/* ═══ INDUCTIONS ═══ */
function IndPg({proj,wkr,ind,setInd,T,bk}){return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>🪪 Inductions</h3>
  {wkr.map(w=>{const x=ind.find(i=>i.wid===w.id);const done=x?Object.values(x.items).filter(Boolean).length:0;const tot=12;
    return<div key={w.id} style={{background:T.c,borderRadius:5,padding:8,marginBottom:4,border:`1px solid ${T.b}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:11,fontWeight:600,color:T.f}}>{w.nm}</div><div style={{fontSize:9,color:T.m}}>{w.role}</div></div>
        {!x?<Btn onClick={()=>setInd(p=>[...p,bInd(proj.id,w.id)])}>Start</Btn>:<span style={{fontSize:10,fontWeight:600,color:done===tot?"#22c55e":"#eab308"}}>{done}/{tot}{done===tot?" ✅":""}</span>}
      </div>
      {x&&<div style={{marginTop:4}}>{Object.entries(x.items).map(([item,chk])=><label key={item} style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10,marginBottom:2,cursor:"pointer"}}><input type="checkbox" checked={chk} onChange={e=>{setInd(ind.map(i=>i.id===x.id?{...i,items:{...i.items,[item]:e.target.checked}}:i))}} style={{accentColor:"#22c55e"}}/><span style={{textDecoration:chk?"line-through":"none",color:chk?"#22c55e":T.f}}>{item}</span></label>)}<CB p={Math.round(done/tot*100)} T={T}/></div>}
    </div>})}
</div>}

/* ═══ REGISTERS ═══ */
function RegPg({proj,regs,setRegs,T,bk}){const[tab,setTab]=useState("coshh");const pid=proj.id;
  const getR=k=>(regs[k]||[]).filter(r=>r.pid===pid);
  const addR=(k,fn)=>setRegs(p=>({...p,[k]:[...(p[k]||[]),fn(pid)]}));
  const delR=(k,id)=>setRegs(p=>({...p,[k]:(p[k]||[]).filter(x=>x.id!==id)}));
  const updR=(k,idx,key,val)=>{const items=[...getR(k)];items[idx]={...items[idx],[key]:val};setRegs(p=>({...p,[k]:[...(p[k]||[]).filter(x=>x.pid!==pid),...items]}))};

  return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>📚 Registers</h3>
    <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:6}}>{Object.entries(REG_T).map(([k,v])=><button key={k} onClick={()=>setTab(k)} style={{padding:"3px 7px",borderRadius:3,border:"none",fontSize:9,cursor:"pointer",background:tab===k?v.c:T.b,color:tab===k?"#fff":T.m,fontWeight:600}}>{v.i} {v.l} ({getR(k).length})</button>)}</div>

    {tab==="coshh"&&<>{<Btn onClick={()=>addR("coshh",bCoshh)}>+ Substance</Btn>}{getR("coshh").map((r,i)=><div key={r.id} style={{background:T.c,borderRadius:5,padding:8,marginBottom:4,border:`1px solid ${T.b}`,borderLeft:"3px solid #ef4444"}}><Fl l="Substance" r><Inp v={r.substance} o={v=>updR("coshh",i,"substance",v)} T={T}/></Fl><div className="g2"><Fl l="Manufacturer"><Inp v={r.manufacturer} o={v=>updR("coshh",i,"manufacturer",v)} T={T}/></Fl><Fl l="SDS Ref"><Inp v={r.sdsRef} o={v=>updR("coshh",i,"sdsRef",v)} T={T}/></Fl></div><Fl l="Hazards"><Txa v={r.hazardType} o={v=>updR("coshh",i,"hazardType",v)} r={2} T={T}/></Fl><Fl l="Controls"><Txa v={r.controls} o={v=>updR("coshh",i,"controls",v)} r={2} T={T}/></Fl><Fl l="PPE"><Inp v={r.ppe} o={v=>updR("coshh",i,"ppe",v)} T={T}/></Fl><Fl l="Emergency Action"><Txa v={r.emergAction} o={v=>updR("coshh",i,"emergAction",v)} r={2} T={T}/></Fl><button onClick={()=>delR("coshh",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>)}</>}

    {tab==="scaffold"&&<>{<Btn onClick={()=>addR("scaffold",bScaff)}>+ Scaffold</Btn>}{getR("scaffold").map((r,i)=>{const d=dTo(r.nextInsp);return<div key={r.id} style={{background:T.c,borderRadius:5,padding:8,marginBottom:4,border:`1px solid ${T.b}`,borderLeft:`3px solid ${d<=0?"#ef4444":d<=7?"#eab308":"#22c55e"}`}}><div className="g2"><Fl l="Location" r><Inp v={r.location} o={v=>updR("scaffold",i,"location",v)} T={T}/></Fl><Fl l="Type"><Inp v={r.type} o={v=>updR("scaffold",i,"type",v)} T={T}/></Fl></div><div className="g2"><Fl l="Last Insp"><Inp v={r.lastInsp} o={v=>updR("scaffold",i,"lastInsp",v)} t="date" T={T}/></Fl><Fl l="Next (7 day)"><Inp v={r.nextInsp} o={v=>updR("scaffold",i,"nextInsp",v)} t="date" T={T}/></Fl></div><Fl l="Inspected By"><Inp v={r.inspBy} o={v=>updR("scaffold",i,"inspBy",v)} T={T}/></Fl><Fl l="Status"><Sel v={r.status} o={v=>updR("scaffold",i,"status",v)} opts={["OK","Minor Defects","Do Not Use"]} T={T}/></Fl><div style={{fontSize:9,color:d<=0?"#ef4444":d<=7?"#eab308":"#22c55e",fontWeight:600}}>{d<=0?`❌ OVERDUE`:d<=2?`⚠️ ${d}d`:`✓ ${d}d`}</div><button onClick={()=>delR("scaffold",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>})}</>}

    {tab==="lifting"&&<>{<Btn onClick={()=>addR("lifting",bLift)}>+ Equipment</Btn>}{getR("lifting").map((r,i)=>{const d=dTo(r.nextExam);return<div key={r.id} style={{background:T.c,borderRadius:5,padding:8,marginBottom:4,border:`1px solid ${T.b}`,borderLeft:`3px solid ${d<=0?"#ef4444":d<=30?"#eab308":"#22c55e"}`}}><div className="g2"><Fl l="Item" r><Inp v={r.item} o={v=>updR("lifting",i,"item",v)} T={T}/></Fl><Fl l="SWL"><Inp v={r.swl} o={v=>updR("lifting",i,"swl",v)} T={T}/></Fl></div><div className="g2"><Fl l="Serial"><Inp v={r.serial} o={v=>updR("lifting",i,"serial",v)} T={T}/></Fl><Fl l="Cert Ref"><Inp v={r.certRef} o={v=>updR("lifting",i,"certRef",v)} T={T}/></Fl></div><div className="g2"><Fl l="Last LOLER Exam"><Inp v={r.lastExam} o={v=>updR("lifting",i,"lastExam",v)} t="date" T={T}/></Fl><Fl l="Next Due"><Inp v={r.nextExam} o={v=>updR("lifting",i,"nextExam",v)} t="date" T={T}/></Fl></div><div style={{fontSize:9,color:d<=0?"#ef4444":"#22c55e",fontWeight:600}}>{d<=0?`❌ OVERDUE`:d<=30?`⚠️ ${d}d`:`✓ ${d}d`}</div><button onClick={()=>delR("lifting",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>})}</>}

    {tab==="fire"&&<>{<Btn onClick={()=>addR("fire",bFire)}>+ Entry</Btn>}{getR("fire").map((r,i)=><div key={r.id} style={{background:T.c,borderRadius:5,padding:6,marginBottom:3,border:`1px solid ${T.b}`}}><div className="g2"><Fl l="Type"><Sel v={r.type} o={v=>updR("fire",i,"type",v)} opts={["Alarm Test","Extinguisher Check","Emergency Light","Fire Drill","Fire Door Check"]} T={T}/></Fl><Fl l="Date"><Inp v={r.date} o={v=>updR("fire",i,"date",v)} t="date" T={T}/></Fl></div><div className="g2"><Fl l="By"><Inp v={r.performedBy} o={v=>updR("fire",i,"performedBy",v)} T={T}/></Fl><Fl l="Result"><Sel v={r.result} o={v=>updR("fire",i,"result",v)} opts={["Pass","Fail","Defect Found"]} T={T}/></Fl></div><button onClick={()=>delR("fire",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>)}</>}

    {tab==="waste"&&<>{<Btn onClick={()=>addR("waste",bWaste)}>+ Transfer</Btn>}{getR("waste").map((r,i)=><div key={r.id} style={{background:T.c,borderRadius:5,padding:6,marginBottom:3,border:`1px solid ${T.b}`,borderLeft:`3px solid ${r.hazardous?"#ef4444":"#22c55e"}`}}><div className="g2"><Fl l="Type" r><Inp v={r.wasteType} o={v=>updR("waste",i,"wasteType",v)} T={T}/></Fl><Fl l="EWC Code"><Inp v={r.ewcCode} o={v=>updR("waste",i,"ewcCode",v)} T={T}/></Fl></div><div className="g2"><Fl l="Qty"><Inp v={r.quantity} o={v=>updR("waste",i,"quantity",v)} T={T}/></Fl><Fl l="Carrier"><Inp v={r.carrier} o={v=>updR("waste",i,"carrier",v)} T={T}/></Fl></div><Fl l="WTN Ref"><Inp v={r.wtnRef} o={v=>updR("waste",i,"wtnRef",v)} T={T}/></Fl><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={r.hazardous} onChange={e=>updR("waste",i,"hazardous",e.target.checked)} style={{accentColor:"#ef4444"}}/>Hazardous</label><button onClick={()=>delR("waste",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>)}</>}

    {tab==="visitor"&&<>{<Btn onClick={()=>addR("visitor",bVisitor)}>+ Visitor</Btn>}{getR("visitor").map((r,i)=><div key={r.id} style={{background:T.c,borderRadius:5,padding:6,marginBottom:3,border:`1px solid ${T.b}`}}><div className="g2"><Fl l="Name" r><Inp v={r.name} o={v=>updR("visitor",i,"name",v)} T={T}/></Fl><Fl l="Company"><Inp v={r.company} o={v=>updR("visitor",i,"company",v)} T={T}/></Fl></div><div className="g2"><Fl l="In"><Inp v={r.timeIn} o={v=>updR("visitor",i,"timeIn",v)} t="time" T={T}/></Fl><Fl l="Out"><Inp v={r.timeOut} o={v=>updR("visitor",i,"timeOut",v)} t="time" T={T}/></Fl></div><div className="g2"><Fl l="Host"><Inp v={r.host} o={v=>updR("visitor",i,"host",v)} T={T}/></Fl></div><label style={{display:"flex",alignItems:"center",gap:4,color:T.f,fontSize:10}}><input type="checkbox" checked={r.inducted} onChange={e=>updR("visitor",i,"inducted",e.target.checked)} style={{accentColor:"#22c55e"}}/>Inducted</label><button onClick={()=>delR("visitor",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>)}</>}

    {tab==="drawing"&&<>{<Btn onClick={()=>addR("drawing",bDrawing)}>+ Drawing</Btn>}{getR("drawing").map((r,i)=><div key={r.id} style={{background:T.c,borderRadius:5,padding:6,marginBottom:3,border:`1px solid ${T.b}`}}><div className="g2"><Fl l="Drawing No." r><Inp v={r.drawingNo} o={v=>updR("drawing",i,"drawingNo",v)} T={T}/></Fl><Fl l="Rev"><Inp v={r.revision} o={v=>updR("drawing",i,"revision",v)} T={T}/></Fl></div><Fl l="Title" r><Inp v={r.title} o={v=>updR("drawing",i,"title",v)} T={T}/></Fl><div className="g2"><Fl l="Author"><Inp v={r.author} o={v=>updR("drawing",i,"author",v)} T={T}/></Fl><Fl l="Status"><Sel v={r.status} o={v=>updR("drawing",i,"status",v)} opts={["For Information","For Comment","For Approval","Approved","Superseded"]} T={T}/></Fl></div><div className="g2"><Fl l="Discipline"><Inp v={r.discipline} o={v=>updR("drawing",i,"discipline",v)} T={T}/></Fl><Fl l="Scale"><Inp v={r.scale} o={v=>updR("drawing",i,"scale",v)} T={T} p="1:100"/></Fl></div><button onClick={()=>delR("drawing",r.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10}}>🗑️</button></div>)}</>}
  </div>}

/* ═══ CHECKLISTS ═══ */
function ChkPg({proj,chk,setChk,T,bk}){const[sel,setSel]=useState(null);
  const start=name=>{const tpl=CK_TPL[name];if(!tpl)return;const cl={id:uid(),pid:proj.id,cr:td(),name,date:td(),by:"",sections:tpl.map(s=>({cat:s.cat,items:s.items.map(i=>({text:i,checked:false,notes:""}))}))};setChk(p=>[...p,cl]);setSel(cl)};
  if(sel){const upd=n=>{setSel(n);setChk(p=>p.map(x=>x.id===n.id?n:x))};const tot=sel.sections.reduce((a,s)=>a+s.items.length,0);const done=sel.sections.reduce((a,s)=>a+s.items.filter(i=>i.checked).length,0);const pct=tot?Math.round(done/tot*100):0;
    return<div className="fi"><Bk T={T} onClick={()=>setSel(null)}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"6px 0"}}><div><div style={{fontSize:14,fontWeight:700,color:T.f}}>✅ {sel.name}</div><div style={{fontSize:10,color:T.m}}>{fmt(sel.date)}</div></div><div style={{fontSize:20,fontWeight:700,color:pct===100?"#22c55e":"#eab308"}}>{pct}%</div></div><CB p={pct} T={T}/><div style={{marginTop:6}}><Fl l="Performed By"><Inp v={sel.by} o={v=>upd({...sel,by:v})} T={T}/></Fl></div>
    {sel.sections.map((section,si)=><Sc key={si} t={section.cat} i="📋" T={T} badge={`${section.items.filter(i=>i.checked).length}/${section.items.length}`}>{section.items.map((item,ii)=><div key={ii} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"3px 0",borderBottom:`1px solid ${T.b}`}}><input type="checkbox" checked={item.checked} onChange={e=>{const n=JSON.parse(JSON.stringify(sel));n.sections[si].items[ii].checked=e.target.checked;upd(n)}} style={{accentColor:"#22c55e",marginTop:3}}/><div style={{flex:1}}><div style={{fontSize:10,color:item.checked?"#22c55e":T.f,textDecoration:item.checked?"line-through":"none"}}>{item.text}</div>{!item.checked&&<input style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${T.b}`,color:T.f,fontSize:9,padding:"2px 0"}} value={item.notes} onChange={e=>{const n=JSON.parse(JSON.stringify(sel));n.sections[si].items[ii].notes=e.target.value;upd(n)}} placeholder="Notes if not OK..."/>}</div></div>)}</Sc>)}</div>}

  return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>✅ Checklists</h3>
    <div style={{fontSize:11,fontWeight:600,color:T.f,marginBottom:3}}>Start New</div>
    <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:8}}>{Object.keys(CK_TPL).map(k=><Btn key={k} c="#065f46" onClick={()=>start(k)}>+ {k}</Btn>)}</div>
    {chk.map(cl=>{const tot=cl.sections.reduce((a,s)=>a+s.items.length,0);const done=cl.sections.reduce((a,s)=>a+s.items.filter(i=>i.checked).length,0);const pct=tot?Math.round(done/tot*100):0;
      return<button key={cl.id} onClick={()=>setSel(cl)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${T.b}`,borderRadius:5,padding:8,marginBottom:3,cursor:"pointer",borderLeft:`3px solid ${pct===100?"#22c55e":"#eab308"}`}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:11,fontWeight:600,color:T.f}}>{cl.name}</div><div style={{fontSize:9,color:T.m}}>{fmt(cl.date)} · {cl.by||"—"}</div></div><span style={{fontSize:14,fontWeight:700,color:pct===100?"#22c55e":"#eab308"}}>{pct}%</span></div><CB p={pct} T={T}/></button>})}</div>}

/* ═══ PERMIT DASHBOARD ═══ */
function PermDash({docs,T,bk,onOD}){const pm=docs.filter(d=>d.dt?.startsWith("permit_"));const live=pm.filter(d=>d.st==="approved"&&d.vT&&new Date(d.vT)>new Date());const exp=pm.filter(d=>d.st==="approved"&&d.vT&&new Date(d.vT)<=new Date());const pend=pm.filter(d=>d.st==="pending");
  return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>🎫 Permits</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
      {[["🟢",live.length,"Live","#22c55e"],["⏳",pend.length,"Pending","#eab308"],["🔴",exp.length,"Expired","#ef4444"]].map(([i,v,l,c],idx)=><div key={idx} style={{background:T.c,borderRadius:8,padding:"8px 4px",textAlign:"center",borderTop:`3px solid ${c}`}}><div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:8,color:T.m}}>{l}</div></div>)}
    </div>
    {live.length>0&&<div style={{fontSize:11,fontWeight:600,color:"#22c55e",marginBottom:3}}>🟢 LIVE</div>}
    {live.map(d=>{const dt=DT[d.dt];const hrs=Math.round((new Date(d.vT)-new Date())/3600000);return<button key={d.id} onClick={()=>onOD(d)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid #22c55e44`,borderRadius:6,padding:8,marginBottom:3,cursor:"pointer",borderLeft:"3px solid #22c55e"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:dt?.c}}>{dt?.i} {dt?.l}</span><span style={{fontSize:9,color:"#22c55e",fontWeight:600}}>{hrs}h left</span></div><div style={{fontSize:11,fontWeight:600,color:T.f}}>{d.loc||"—"}</div><div style={{fontSize:9,color:T.m}}>{d.no}</div></button>})}
    {pend.map(d=>{const dt=DT[d.dt];return<button key={d.id} onClick={()=>onOD(d)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${T.b}`,borderRadius:5,padding:8,marginBottom:3,cursor:"pointer",borderLeft:"3px solid #eab308"}}><div style={{fontSize:10,color:dt?.c}}>{dt?.i} {dt?.l}</div><div style={{fontSize:11,color:T.f}}>{d.loc||"—"}</div></button>})}
    {exp.map(d=>{const dt=DT[d.dt];return<button key={d.id} onClick={()=>onOD(d)} style={{display:"block",width:"100%",textAlign:"left",background:T.c,border:`1px solid ${T.b}`,borderRadius:5,padding:8,marginBottom:3,cursor:"pointer",borderLeft:"3px solid #ef4444",opacity:.7}}><div style={{fontSize:10,color:"#ef4444"}}>{dt?.i} {dt?.l} — EXPIRED</div><div style={{fontSize:11,color:T.f}}>{d.loc||"—"}</div></button>})}
    {pm.length===0&&<div style={{textAlign:"center",padding:16,color:T.m}}>No permits</div>}</div>}

/* ═══ WEATHER ═══ */
function WeatherPg({p,T,bk}){const[wx,setWx]=useState(null);const[loading,setLoading]=useState(false);
  const fetch_=async()=>{setLoading(true);try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat||51.5}&longitude=${p.lng||-0.1}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&timezone=Europe/London&forecast_days=3`);setWx(await r.json())}catch{}setLoading(false)};
  const wI=c=>c<=1?"☀️":c<=3?"⛅":c<=49?"🌫️":c<=59?"🌧️":c<=69?"🌨️":c<=79?"❄️":c<=99?"⛈️":"🌤️";
  return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>🌤️ Weather — {p.nm}</h3>
    <Btn c="#1e40af" onClick={fetch_}>{loading?"Loading...":"🌤️ Get Weather"}</Btn>
    {wx?.current&&<div style={{background:T.c,borderRadius:10,padding:16,marginTop:8,textAlign:"center"}}>
      <div style={{fontSize:48}}>{wI(wx.current.weather_code)}</div>
      <div style={{fontSize:28,fontWeight:700,color:T.f}}>{wx.current.temperature_2m}°C</div>
      <div style={{fontSize:11,color:T.m}}>Wind: {wx.current.wind_speed_10m}km/h · Humidity: {wx.current.relative_humidity_2m}%</div>
      <div style={{textAlign:"left",marginTop:8}}>
        {wx.current.wind_speed_10m>40&&<div style={{fontSize:10,color:"#ef4444",fontWeight:600}}>⚠️ HIGH WIND — Review crane/height work</div>}
        {wx.current.temperature_2m<3&&<div style={{fontSize:10,color:"#3b82f6",fontWeight:600}}>❄️ FROST RISK — Check surfaces</div>}
        {wx.current.temperature_2m>30&&<div style={{fontSize:10,color:"#f97316",fontWeight:600}}>🌡️ HEAT — Water, rest breaks, shade</div>}
        {wx.current.weather_code>=60&&<div style={{fontSize:10,color:"#3b82f6",fontWeight:600}}>🌧️ RAIN — Slip hazards, excavation stability</div>}
      </div>
    </div>}
    {wx?.daily&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:8}}>{wx.daily.time.map((day,i)=><div key={i} style={{background:T.c,borderRadius:8,padding:8,textAlign:"center",border:`1px solid ${T.b}`}}><div style={{fontSize:9,color:T.m}}>{fmt(day)}</div><div style={{fontSize:24}}>{wI(wx.daily.weather_code[i])}</div><div style={{fontSize:11,fontWeight:600,color:T.f}}>{wx.daily.temperature_2m_max[i]}°/{wx.daily.temperature_2m_min[i]}°</div></div>)}</div>}
    {wx?.current&&<div style={{background:T.c,borderRadius:8,padding:10,marginTop:8,border:`1px solid ${T.b}`}}><div style={{fontSize:11,fontWeight:600,color:"#f97316",marginBottom:3}}>📋 Daily Briefing</div><div style={{fontSize:10,color:T.f,lineHeight:1.6}}><b>Site:</b> {p.nm} — {fmt(td())}<br/><b>Weather:</b> {wI(wx.current.weather_code)} {wx.current.temperature_2m}°C, Wind {wx.current.wind_speed_10m}km/h<br/>{wx.current.wind_speed_10m>40?<><b style={{color:"#ef4444"}}>⚠️ Wind:</b> Lifting/height review<br/></>:""}{wx.current.temperature_2m<3?<><b style={{color:"#3b82f6"}}>❄️ Ice:</b> Gritting required<br/></>:""}<b>Check:</b> PPE, RAMS, permits, toolbox talk</div></div>}
  </div>}

/* ═══ TIMELINE ═══ */
function TimelinePg({docs,pho,T,bk}){const items=[...docs.map(d=>({id:d.id,date:d.cr,type:"doc",title:`${(DT[d.dt]||{}).i||"📄"} ${(DT[d.dt]||{}).l||"Doc"} created`,sub:d.no||d.loc||d.subj||"",st:d.st})),...docs.filter(d=>d.st==="approved").map(d=>({id:d.id+"_a",date:d.up,type:"approved",title:`✅ ${(DT[d.dt]||{}).l} approved`,sub:d.no})),...pho.map(p=>({id:p.id,date:p.cr,type:"photo",title:"📸 Photo",sub:p.desc||""}))].sort((a,b)=>b.date.localeCompare(a.date));
  let last="";return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>📰 Timeline</h3>
    {items.map(it=>{const show=it.date!==last;last=it.date;return<div key={it.id}>{show&&<div style={{fontSize:10,fontWeight:600,color:"#f97316",margin:"8px 0 3px",paddingLeft:16}}>{fmt(it.date)}</div>}<div style={{display:"flex",gap:8,marginBottom:3}}><div style={{width:10,display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{width:6,height:6,borderRadius:"50%",background:it.type==="approved"?"#22c55e":"#f97316",marginTop:4}}/><div style={{width:1,flex:1,background:T.b}}/></div><div style={{flex:1,background:T.c,borderRadius:4,padding:6,border:`1px solid ${T.b}`}}><div style={{fontSize:10,fontWeight:600,color:T.f}}>{it.title}</div>{it.sub&&<div style={{fontSize:9,color:T.m}}>{it.sub}</div>}</div></div></div>})}</div>}

/* ═══ CALENDAR ═══ */
function CalendarPg({docs,wkr,equ,T,bk}){const[mo,setMo]=useState(new Date().getMonth());const[yr,setYr]=useState(new Date().getFullYear());
  const dim=new Date(yr,mo+1,0).getDate();const fd=new Date(yr,mo,1).getDay()||7;
  const events=[];wkr.forEach(w=>w.certs.forEach(c=>{if(c.expiry)events.push({date:c.expiry,label:`${w.nm}: ${c.type}`,color:dTo(c.expiry)<=0?"#ef4444":"#3b82f6"})}));equ.forEach(e=>{if(e.inspNext)events.push({date:e.inspNext,label:`${e.nm} insp`,color:"#06b6d4"})});docs.filter(d=>d.dt?.startsWith("permit_")&&d.vT).forEach(d=>events.push({date:d.vT.split("T")[0],label:`${(DT[d.dt]||{}).i} ${d.no} expires`,color:"#a855f7"}));
  const evDay=day=>{const ds=`${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;return events.filter(e=>e.date===ds)};
  return<div className="fi"><Bk T={T} onClick={bk}/><h3 style={{fontSize:14,fontWeight:700,color:T.f,margin:"6px 0"}}>📅 Calendar</h3>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><button onClick={()=>{if(mo===0){setMo(11);setYr(yr-1)}else setMo(mo-1)}} style={{background:T.c,border:`1px solid ${T.b}`,color:T.f,borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>◀</button><span style={{fontSize:13,fontWeight:600,color:T.f}}>{new Date(yr,mo).toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</span><button onClick={()=>{if(mo===11){setMo(0);setYr(yr+1)}else setMo(mo+1)}} style={{background:T.c,border:`1px solid ${T.b}`,color:T.f,borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>▶</button></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:2}}>{["Mo","Tu","We","Th","Fr","Sa","Su"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:T.m,padding:3}}>{d}</div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>{Array.from({length:fd-1},(_,i)=><div key={`e${i}`}/>)}{Array.from({length:dim},(_,i)=>{const day=i+1;const today=day===new Date().getDate()&&mo===new Date().getMonth()&&yr===new Date().getFullYear();const de=evDay(day);
      return<div key={day} style={{background:today?T.c:T.c2,border:today?`2px solid #f97316`:`1px solid ${T.b}`,borderRadius:3,padding:2,minHeight:36}}><div style={{fontSize:9,fontWeight:today?700:400,color:today?"#f97316":T.f}}>{day}</div>{de.slice(0,2).map((e,j)=><div key={j} style={{fontSize:6,padding:"0 1px",borderRadius:1,background:e.color+"33",color:e.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}</div>)}{de.length>2&&<div style={{fontSize:6,color:T.m}}>+{de.length-2}</div>}</div>})}</div>
    <div style={{marginTop:8,fontSize:11,fontWeight:600,color:T.f,marginBottom:3}}>Upcoming</div>
    {events.filter(e=>dTo(e.date)>=0&&dTo(e.date)<=30).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8).map((e,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.b}`}}><span style={{fontSize:10,color:T.f}}>{e.label}</span><span style={{fontSize:9,color:e.color,fontWeight:600}}>{dTo(e.date)===0?"TODAY":`${dTo(e.date)}d`}</span></div>)}
  </div>}
