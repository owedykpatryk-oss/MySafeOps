import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const ss = ms;

const DEMO_TRACKS = [
  { title: "15 min demo", audience: "HSE manager", focus: "Permit controls, evidence matrix, audit traceability." },
  { title: "30 min demo", audience: "Operations manager", focus: "Live wall, SLA automation, incident flow, site pack." },
  { title: "45 min demo", audience: "Director / client", focus: "Executive KPI, ROI, trust/compliance, enterprise readiness." },
];

export default function SalesEnablementHub() {
  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", fontSize:14 }}>
      <PageHero
        badgeText="GTM"
        title="Sales enablement hub"
        lead="Demo scripts, pilot playbook, and objection handling assets aligned to product capabilities."
      />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10, marginBottom:14 }}>
        {DEMO_TRACKS.map((d) => (
          <div key={d.title} style={ss.card}>
            <div style={{ fontWeight:700 }}>{d.title}</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>{d.audience}</div>
            <div style={{ marginTop:8, fontSize:13 }}>{d.focus}</div>
          </div>
        ))}
      </div>
      <div style={ss.card}>
        <h3 style={{ marginTop:0 }}>Pilot (30 days) checklist</h3>
        <ol style={{ margin:0, paddingLeft:18, lineHeight:1.6 }}>
          <li>Kickoff baseline: current permit lead time and expired-without-action rate.</li>
          <li>Week 1-2: enable survey packs + strict QA + notifications.</li>
          <li>Week 3: run incident + corrective action traceability drill.</li>
          <li>Week 4: produce executive scorecard and ROI summary for close plan.</li>
        </ol>
      </div>
    </div>
  );
}

