// MySafeOps — Notification Settings Panel
// Add to your Settings screen

import { useState, useEffect } from "react";
import {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCloudPushHealth,
  getNotificationStatus,
  startNotificationScheduler,
  stopNotificationScheduler,
  runNotificationCheckNow,
  sendCloudPermitPush,
  showLocalNotification,
} from "./pushNotifications";
import PageHero from "../components/PageHero";

const ss = {
  btn:  { padding:"7px 14px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { padding:"7px 14px", borderRadius:6, border:"0.5px solid #085041", background:"#0d9488", color:"#E1F5EE", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", display:"inline-flex", alignItems:"center", gap:6 },
  card: { background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, padding:"1.25rem" },
  row:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" },
};

function Toggle({ value, onChange }) {
  return (
    <div onClick={onChange} style={{
      width:40, height:22, borderRadius:11, cursor:"pointer",
      background:value?"#0d9488":"var(--color-border-secondary,#ccc)",
      position:"relative", transition:"background .2s", flexShrink:0,
    }}>
      <div style={{
        position:"absolute", top:3, left:value?20:3,
        width:16, height:16, borderRadius:"50%", background:"#fff",
        transition:"left .2s",
      }} />
    </div>
  );
}

export default function NotificationSettings() {
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mysafeops_notif_prefs") || "{}"); }
    catch { return {}; }
  });

  const savePref = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    localStorage.setItem("mysafeops_notif_prefs", JSON.stringify(next));
  };

  useEffect(() => {
    getNotificationStatus().then(setStatus);
  }, []);

  const refreshHealth = async () => {
    setHealthLoading(true);
    try {
      const snapshot = await getCloudPushHealth();
      setHealth(snapshot);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (!status) return;
    void refreshHealth();
  }, [status?.permission, status?.subscribed, status?.swReady, status?.vapidConfigured]);

  useEffect(() => {
    if (!status || status.permission !== "granted" || prefs.master === false) return undefined;
    const stop = startNotificationScheduler();
    return () => stop?.();
  }, [status, prefs.master]);

  const handleEnable = async () => {
    setLoading(true);
    const perm = await requestNotificationPermission();
    if (perm === "granted") {
      await subscribeToPush().catch(() => {});
      if (prefs.master !== false) startNotificationScheduler();
    }
    const s = await getNotificationStatus();
    setStatus(s);
    setLoading(false);
  };

  const handleDisable = async () => {
    setLoading(true);
    stopNotificationScheduler();
    await unsubscribeFromPush();
    const s = await getNotificationStatus();
    setStatus(s);
    setLoading(false);
  };

  const testNotif = () => {
    showLocalNotification("MySafeOps test", {
      body: "Notifications are working correctly.",
      tag: "test",
    });
  };

  const testCloudPush = async () => {
    const result = await sendCloudPermitPush({
      title: "MySafeOps cloud push test",
      body: "Background web push channel is working.",
      tag: `cloud_test_${Date.now()}`,
      url: "/?tab=permits",
      permit: { id: "TEST", type: "general", status: "active", location: "Workspace" },
    });
    if (result?.ok && !result?.skipped) {
      window.alert(`Cloud push sent (${result?.sent ?? 0} endpoint(s)).`);
      return;
    }
    window.alert(result?.reason === "supabase_not_configured" ? "Supabase not configured for cloud push." : (result?.error || "Cloud push test skipped/failed."));
  };

  const repairSubscription = async () => {
    setRepairLoading(true);
    try {
      const perm = await requestNotificationPermission();
      if (perm !== "granted") {
        window.alert("Notification permission is required before subscription repair.");
        return;
      }
      await unsubscribeFromPush().catch(() => {});
      const sub = await subscribeToPush().catch(() => null);
      const s = await getNotificationStatus();
      setStatus(s);
      await refreshHealth();
      window.alert(sub || s?.subscribed ? "Push subscription repaired and synced." : "Repair completed, but subscription is still missing.");
    } finally {
      setRepairLoading(false);
    }
  };

  if (!status) return null;

  const enabled = status.permission === "granted";
  const denied = status.permission === "denied";

  const NOTIFICATION_TYPES = [
    { key: "master",         label: "Enable all reminder checks",       sub: "Master switch for scheduled notification scans" },
    { key: "cert_expiry",    label: "Certificate expiry reminders",    sub: "30, 14, 7 and 1 day before expiry" },
    { key: "permit_expiry",  label: "Permit expiry reminders",         sub: "14, 7 and 1 day before expiry" },
    { key: "permit_briefing",label: "Permit briefing pending alerts",   sub: "Active high-risk permits with missing briefing confirmation" },
    { key: "permit_rams_link",label: "Permit missing RAMS alerts",      sub: "Active permits without linked RAMS document" },
    { key: "rams_review",    label: "RAMS review due reminders",       sub: "14 days before review date" },
    { key: "equip_inspect",  label: "Equipment inspection reminders",  sub: "14 and 7 days before due date" },
    { key: "timesheet",      label: "Timesheet approval reminders",    sub: "When timesheets are awaiting approval" },
    { key: "snag_overdue",   label: "Overdue snag alerts",             sub: "When snag items pass their due date" },
  ];

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", fontSize:14, color:"var(--color-text-primary)" }}>
      <PageHero
        badgeText="NTF"
        title="Notifications"
        lead="Reminders for expiring certifications, permits, RAMS reviews, and more (browser permission required)."
      />
      <div style={{ ...ss.card, marginBottom:16 }}>

        {!status.supported && (
          <div style={{ padding:"10px 14px", background:"#FAEEDA", borderRadius:8, fontSize:13, color:"#633806" }}>
            Notifications are not supported in this browser.
          </div>
        )}

        {status.supported && denied && (
          <div style={{ padding:"10px 14px", background:"#FCEBEB", borderRadius:8, fontSize:13, color:"#791F1F" }}>
            Notifications are blocked in your browser settings. To enable, click the lock icon in your address bar and allow notifications for this site.
          </div>
        )}

        {status.supported && !status.vapidConfigured && (
          <div style={{ padding:"10px 14px", background:"#FFFBEB", borderRadius:8, fontSize:13, color:"#854d0e", marginBottom:12 }}>
            Background cloud push is not fully configured yet (missing `VITE_VAPID_PUBLIC_KEY` in frontend env). Local reminders still work while the app is open.
          </div>
        )}

        {status.supported && !denied && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:enabled?"#EAF3DE":"var(--color-background-secondary,#f7f7f5)", borderRadius:8, marginBottom:enabled?16:0 }}>
            <div>
              <div style={{ fontWeight:500, fontSize:13, color:enabled?"#27500A":"var(--color-text-primary)" }}>
                {enabled ? "Notifications enabled" : "Notifications disabled"}
              </div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>
                {enabled ? "You will receive alerts for expiring items" : "Enable to receive reminders and alerts"}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {enabled && <button onClick={testNotif} style={{ ...ss.btn, fontSize:12 }}>Test</button>}
              {enabled && <button onClick={() => void testCloudPush()} style={{ ...ss.btn, fontSize:12 }}>Test cloud push</button>}
              {enabled && <button onClick={runNotificationCheckNow} style={{ ...ss.btn, fontSize:12 }}>Run check now</button>}
              {enabled
                ? <button onClick={handleDisable} disabled={loading} style={{ ...ss.btn, fontSize:12 }}>{loading?"…":"Disable"}</button>
                : <button onClick={handleEnable} disabled={loading} style={{ ...ss.btnP, fontSize:12 }}>{loading?"Enabling…":"Enable notifications"}</button>
              }
            </div>
          </div>
        )}

        {enabled && (
          <div>
            <div style={{ marginBottom:12, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>Push health diagnostics</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <button onClick={() => void refreshHealth()} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                    {healthLoading ? "Checking..." : "Refresh health"}
                  </button>
                  <button onClick={() => void repairSubscription()} disabled={repairLoading} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                    {repairLoading ? "Repairing..." : "Repair subscription"}
                  </button>
                </div>
              </div>
              <div style={{ display:"grid", gap:6, fontSize:12 }}>
                <div>Browser support: <strong>{health?.supported ? "OK" : "No"}</strong></div>
                <div>Permission: <strong>{health?.permission || status.permission}</strong></div>
                <div>Service worker: <strong>{health?.swReady ? "Ready" : "Not ready"}</strong></div>
                <div>Frontend VAPID key: <strong>{health?.vapidConfigured ? "Configured" : "Missing"}</strong></div>
                <div>Device subscription: <strong>{health?.subscribed ? "Active" : "Missing"}</strong></div>
                <div>
                  Cloud function:{" "}
                  <strong>{health?.cloud?.ok ? "Reachable" : "Issue"}</strong>
                  {health?.cloud?.subscriptions != null ? ` · endpoints: ${health.cloud.subscriptions}` : ""}
                  {health?.cloud?.reason ? ` · ${health.cloud.reason}` : ""}
                </div>
              </div>
            </div>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>
              Notification types
            </div>
            {NOTIFICATION_TYPES.map(t=>(
              <div key={t.key} style={ss.row}>
                <div>
                  <div style={{ fontSize:13 }}>{t.label}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{t.sub}</div>
                </div>
                <Toggle value={prefs[t.key] !== false} onChange={()=>savePref(t.key, prefs[t.key]===false)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding:"10px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Notifications run locally in your browser. No data is sent to external servers.
        For background notifications when the app is closed, a push server with VAPID keys is required.
      </div>
    </div>
  );
}
