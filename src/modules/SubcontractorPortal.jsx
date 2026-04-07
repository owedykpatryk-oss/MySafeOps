import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => `${k}_${getOrgId()}`;
const load = (k, fb) => {
  try {
    return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb));
  } catch {
    return fb;
  }
};
const save = (k, v) => localStorage.setItem(sk(k), JSON.stringify(v));
const genId = () => `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const ss = {
  btn: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif" },
  btnP: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#E1F5EE", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif" },
  inp: { width: "100%", padding: "7px 10px", border: "0.5px solid #ccc", borderRadius: 6, fontSize: 13, fontFamily: "DM Sans,sans-serif", boxSizing: "border-box" },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

export function PublicSubcontractorView({ token }) {
  const portals = load("subcontractor_portals", []);
  const portal = portals.find((p) => p.token === token && p.active);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [ramsSummary, setRamsSummary] = useState("");
  const [certName, setCertName] = useState("");
  const [certData, setCertData] = useState(null);
  const [done, setDone] = useState(false);

  if (!portal) {
    return (
      <div style={{ fontFamily: "DM Sans,sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <p style={{ color: "#64748b" }}>Invalid or inactive subcontractor link.</p>
      </div>
    );
  }

  const expired = portal.expiresAt && new Date(portal.expiresAt) < new Date();
  if (expired) {
    return (
      <div style={{ fontFamily: "DM Sans,sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <p style={{ color: "#64748b" }}>This link has expired.</p>
      </div>
    );
  }

  const submit = () => {
    if (!company.trim()) return;
    const subs = load("subcontractor_submissions", []);
    const row = {
      id: genId(),
      portalId: portal.id,
      company: company.trim(),
      contact: contact.trim(),
      ramsSummary: ramsSummary.trim(),
      certName: certName.trim(),
      certFile: certData,
      submittedAt: new Date().toISOString(),
    };
    save("subcontractor_submissions", [row, ...subs]);
    setDone(true);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || f.size > 800000) {
      alert("File too large (max ~800KB for local storage)");
      return;
    }
    const r = new FileReader();
    r.onload = () => setCertData({ name: f.name, dataUrl: r.result });
    r.readAsDataURL(f);
  };

  if (done) {
    return (
      <div style={{ fontFamily: "DM Sans,sans-serif", padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
        <div style={ss.card}>
          <h2 style={{ marginTop: 0 }}>Thank you</h2>
          <p style={{ fontSize: 14, color: "#64748b" }}>Your submission was recorded on this device for the main contractor to review in MySafeOps.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "DM Sans,sans-serif", padding: "1.5rem 1rem", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>Subcontractor pack</h1>
      <p style={{ fontSize: 13, color: "#64748b" }}>{portal.instructions || "Submit your company details, RAMS summary, and optional competency certificate."}</p>
      <div style={ss.card}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Company name *</label>
        <input style={ss.inp} value={company} onChange={(e) => setCompany(e.target.value)} />
        <label style={{ display: "block", fontSize: 12, marginTop: 10 }}>Contact (email / phone)</label>
        <input style={ss.inp} value={contact} onChange={(e) => setContact(e.target.value)} />
        <label style={{ display: "block", fontSize: 12, marginTop: 10 }}>RAMS / scope summary</label>
        <textarea style={{ ...ss.inp, minHeight: 100, resize: "vertical" }} value={ramsSummary} onChange={(e) => setRamsSummary(e.target.value)} />
        <label style={{ display: "block", fontSize: 12, marginTop: 10 }}>Certificate label</label>
        <input style={ss.inp} value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="e.g. CSCS, IPAF" />
        <label style={{ display: "block", fontSize: 12, marginTop: 10 }}>Upload certificate (optional)</label>
        <input type="file" accept="image/*,application/pdf" onChange={onFile} />
        {certData && <div style={{ fontSize: 12, marginTop: 6 }}>Attached: {certData.name}</div>}
        <button type="button" style={{ ...ss.btnP, marginTop: 16 }} onClick={submit}>
          Submit
        </button>
      </div>
    </div>
  );
}

export default function SubcontractorPortal() {
  const { caps } = useApp();
  const [portals, setPortals] = useState(() => load("subcontractor_portals", []));
  const [subs, setSubs] = useState(() => load("subcontractor_submissions", []));
  const [show, setShow] = useState(false);
  const [instr, setInstr] = useState("");

  useEffect(() => {
    save("subcontractor_portals", portals);
  }, [portals]);
  useEffect(() => {
    save("subcontractor_submissions", subs);
  }, [subs]);

  useEffect(() => {
    const subKey = sk("subcontractor_submissions");
    const onStorage = (e) => {
      if (e.key === subKey && e.newValue) {
        try {
          setSubs(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const create = () => {
    const p = {
      id: genId(),
      token: genId(),
      active: true,
      instructions: instr.trim(),
      createdAt: new Date().toISOString(),
    };
    setPortals((x) => [p, ...x]);
    setShow(false);
    setInstr("");
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Subcontractor portal</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>Share a link for subs to submit details — stored only on this browser</p>
        </div>
        {caps.subcontractorManage && (
          <button type="button" style={ss.btnP} onClick={() => setShow(true)}>
            + New link
          </button>
        )}
      </div>
      {show && (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Instructions for subcontractor</label>
          <textarea style={{ ...ss.inp, minHeight: 72 }} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Site rules, what to upload, deadline…" />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" style={ss.btn} onClick={() => setShow(false)}>
              Cancel
            </button>
            <button type="button" style={ss.btnP} onClick={create}>
              Create
            </button>
          </div>
        </div>
      )}
      <h3 style={{ fontSize: 14 }}>Links</h3>
      {portals.map((p) => {
        const url = `${window.location.origin}${window.location.pathname}?subcontractor=${p.token}`;
        return (
          <div key={p.id} style={{ ...ss.card, marginBottom: 8 }}>
            <div style={{ fontSize: 12, wordBreak: "break-all", marginBottom: 8 }}>{url}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={ss.btnP} onClick={() => navigator.clipboard?.writeText(url)}>
                Copy
              </button>
              <button type="button" style={ss.btn} onClick={() => setPortals((x) => x.map((y) => (y.id === p.id ? { ...y, active: !y.active } : y)))}>
                {p.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        );
      })}
      <h3 style={{ fontSize: 14, marginTop: 24 }}>Submissions ({subs.length})</h3>
      {subs.map((s) => (
        <div key={s.id} style={{ ...ss.card, marginBottom: 8, fontSize: 13 }}>
          <strong>{s.company}</strong> · {new Date(s.submittedAt).toLocaleString("en-GB")}
          <div style={{ color: "#64748b" }}>{s.contact}</div>
          <div style={{ marginTop: 6 }}>{s.ramsSummary}</div>
          {s.certName && <div style={{ marginTop: 6 }}>Cert: {s.certName}</div>}
        </div>
      ))}
    </div>
  );
}
