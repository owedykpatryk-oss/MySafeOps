import { loadOrgScoped as load } from "../utils/orgStorage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const ss = ms;

export default function ClientAcquisitionPlaybook() {
  const permits = load("permits_v2", []);
  const rams = load("rams_builder_docs", []);
  const incidents = load("permit_incidents_v1", []);
  const activePermits = permits.filter((p) => p.status === "active").length;
  const issuedRams = rams.filter((d) => ["approved", "issued"].includes(String(d.documentStatus || d.status || ""))).length;
  const timeToValue = activePermits > 0 && issuedRams > 0 ? "achieved" : "in progress";

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", fontSize:14 }}>
      <PageHero
        badgeText="Growth"
        title="Client acquisition playbook"
        lead="Vertical packs, onboarding flows, and ROI proof points to increase trial-to-paid conversion."
      />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10, marginBottom:14 }}>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Active permits</div><div style={{ fontSize:24, fontWeight:700 }}>{activePermits}</div></div>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Issued RAMS</div><div style={{ fontSize:24, fontWeight:700 }}>{issuedRams}</div></div>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Open incidents</div><div style={{ fontSize:24, fontWeight:700 }}>{incidents.length}</div></div>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Time-to-value</div><div style={{ fontSize:20, fontWeight:700, textTransform:"capitalize" }}>{timeToValue}</div></div>
      </div>
      <div style={ss.card}>
        <h3 style={{ marginTop:0 }}>Recommended growth motions</h3>
        <ul style={{ margin:0, paddingLeft:18, lineHeight:1.6 }}>
          <li>Ship vertical packs: utilities, civils/highways, water/wastewater.</li>
          <li>Run guided onboarding: first permit, first RAMS, first site pack in 1 day.</li>
          <li>Share executive scorecard weekly with compliance and SLA improvements.</li>
          <li>Enable white-label client portal for contractor + end-client visibility.</li>
        </ul>
      </div>
    </div>
  );
}

