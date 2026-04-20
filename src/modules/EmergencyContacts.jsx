import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { MapPin, Phone } from "lucide-react";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import {
  loadEmergencySiteExtras,
  saveEmergencySiteExtras,
  googleMapsSearchUrl,
  googleMapsDirectionsUrl,
} from "../utils/emergencySiteExtras";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";

const genRowId = () => `ec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const ss = ms;

const DEFAULT_ROWS = [
  { id: genRowId(), label: "Emergency (UK)", phone: "999", notes: "Police / ambulance / fire" },
  { id: genRowId(), label: "NHS non-emergency", phone: "111", notes: "" },
  { id: genRowId(), label: "Gas emergency", phone: "0800 111 999", notes: "" },
];

const DEFAULT_SITE_EXTRAS = {
  siteAddress: "",
  nearestHospital: "",
  hospitalDirectionsUrl: "",
  siteMapUrl: "",
};

export default function EmergencyContacts() {
  const [siteExtras, setSiteExtras] = useState(() => ({ ...DEFAULT_SITE_EXTRAS, ...loadEmergencySiteExtras() }));

  const [rows, setRows] = useState(() => {
    const data = load("emergency_contacts", null);
    if (Array.isArray(data) && data.length) return data;
    return DEFAULT_ROWS;
  });
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("emergency_contacts", rows);
  }, [rows]);

  useEffect(() => {
    saveEmergencySiteExtras(siteExtras);
  }, [siteExtras]);

  const setExtra = (field, value) => {
    setSiteExtras((s) => ({ ...s, [field]: value }));
  };

  const update = (id, field, value) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  };

  const addRow = () => {
    setRows((r) => [...r, { id: genRowId(), label: "", phone: "", notes: "" }]);
    pushAudit({ action: "emergency_contacts_add", entity: "contacts", detail: "" });
  };

  const removeRow = (id) => {
    if (!confirm("Remove this contact line?")) return;
    setRows((r) => r.filter((x) => x.id !== id));
    pushAudit({ action: "emergency_contacts_remove", entity: "contacts", detail: id });
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="999"
        title="Emergency contacts"
        lead="Site-specific numbers alongside national services. Tap phone on mobile where supported. RAMS can import site and hospital details from here."
      />

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          <MapPin size={18} strokeWidth={2} aria-hidden />
          Site &amp; nearest A&amp;E
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", maxWidth: 560 }}>
          Used by <strong>RAMS</strong> via &quot;Import from Emergency&quot;. No API — links open Google Maps in the browser.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ss.lbl}>Default site address (for maps search)</label>
            <input
              style={ss.inp}
              value={siteExtras.siteAddress || ""}
              onChange={(e) => setExtra("siteAddress", e.target.value)}
              placeholder="e.g. Postcode or street, town"
            />
          </div>
          <div>
            <label style={ss.lbl}>Nearest A&amp;E / hospital</label>
            <input
              style={ss.inp}
              value={siteExtras.nearestHospital || ""}
              onChange={(e) => setExtra("nearestHospital", e.target.value)}
              placeholder="Hospital name"
            />
          </div>
          <div>
            <label style={ss.lbl}>Directions URL (Google Maps)</label>
            <input
              style={ss.inp}
              value={siteExtras.hospitalDirectionsUrl || ""}
              onChange={(e) => setExtra("hospitalDirectionsUrl", e.target.value)}
              placeholder="https://maps.google.com/…"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ss.lbl}>Map link (OSM / other)</label>
            <input
              style={ss.inp}
              value={siteExtras.siteMapUrl || ""}
              onChange={(e) => setExtra("siteMapUrl", e.target.value)}
              placeholder="Optional link copied into RAMS"
            />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {siteExtras.siteAddress?.trim() && (
            <a
              href={googleMapsSearchUrl(siteExtras.siteAddress)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...ss.btn, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Open site in Google Maps
            </a>
          )}
          {siteExtras.nearestHospital?.trim() && (
            <a
              href={googleMapsDirectionsUrl(siteExtras.nearestHospital)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...ss.btn, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Directions to A&amp;E (Google Maps)
            </a>
          )}
        </div>
      </div>

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          <Phone size={18} strokeWidth={2} aria-hidden />
          Contact list
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {listPg.hasMore(rows) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, rows.length)} of {rows.length} contacts
            </div>
          ) : null}
          {listPg.visible(rows).map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
                gap: 8,
                paddingBottom: 12,
                borderBottom: "0.5px solid var(--color-border-tertiary,#eee)",
                contentVisibility: "auto",
                containIntrinsicSize: "0 120px",
              }}
            >
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" style={{ ...ss.btn, fontSize: 12, color: "#A32D2D" }} onClick={() => removeRow(row.id)}>
                  Remove
                </button>
              </div>
              <div>
                <label style={ss.lbl}>Name / role</label>
                <input style={ss.inp} value={row.label} onChange={(e) => update(row.id, "label", e.target.value)} placeholder="e.g. Site manager" />
              </div>
              <div>
                <label style={ss.lbl}>Telephone</label>
                <input style={ss.inp} value={row.phone} onChange={(e) => update(row.id, "phone", e.target.value)} inputMode="tel" />
                {row.phone && (
                  <a href={`tel:${row.phone.replace(/\s/g, "")}`} style={{ fontSize: 12, color: "#0d9488", marginTop: 4, display: "inline-block" }}>
                    Call
                  </a>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl}>Notes</label>
                <input style={ss.inp} value={row.notes || ""} onChange={(e) => update(row.id, "notes", e.target.value)} placeholder="Optional" />
              </div>
            </div>
          ))}
          {listPg.hasMore(rows) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(rows)} remaining)
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" style={{ ...ss.btnP, marginTop: 8 }} onClick={addRow}>
          + Add contact
        </button>
      </div>
    </div>
  );
}
