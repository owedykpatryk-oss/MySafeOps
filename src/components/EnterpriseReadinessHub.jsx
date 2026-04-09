import { loadOrgScoped as load } from "../utils/orgStorage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";

const ss = ms;

export default function EnterpriseReadinessHub() {
  const permits = load("permits_v2", []);
  const incidents = load("permit_incidents_v1", []);
  const plans = load("project_plan_overlays_v1", []);
  const notificationEvents = permits.flatMap((p) => p.notificationLog || []).length;

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", fontSize:14 }}>
      <PageHero
        badgeText="Enterprise"
        title="Platform scale & readiness"
        lead="Operational reliability, integration observability, and governance controls for enterprise rollouts."
      />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10, marginBottom:14 }}>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Permits tracked</div><div style={{ fontSize:24, fontWeight:700 }}>{permits.length}</div></div>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Incident records</div><div style={{ fontSize:24, fontWeight:700 }}>{incidents.length}</div></div>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Safety maps</div><div style={{ fontSize:24, fontWeight:700 }}>{plans.length}</div></div>
        <div style={ss.card}><div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Delivery events</div><div style={{ fontSize:24, fontWeight:700 }}>{notificationEvents}</div></div>
      </div>
      <div style={ss.card}>
        <h3 style={{ marginTop:0 }}>Readiness controls</h3>
        <ul style={{ margin:0, paddingLeft:18, lineHeight:1.6 }}>
          <li>Multi-channel delivery logs with failure/retry visibility.</li>
          <li>SLA digest export for governance and weekly steering.</li>
          <li>Permit ↔ RAMS ↔ Incident traceability chain with timestamps.</li>
          <li>Project plan overlays with pinned incident evidence.</li>
          <li>Foundation for API/webhook and centralized portfolio governance.</li>
        </ul>
      </div>
    </div>
  );
}

