import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { refreshOrgFromSupabase } from "../utils/orgMembership";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import { INDUSTRY_SECTOR_GROUPS, getIndustrySectorLabel, getSectorRegisterHints } from "../utils/industrialSectors";
import { CUSTOM_FIELD_PRESETS } from "../utils/orgCustomFields";
import { resetSectorBannerDismiss } from "../utils/sectorBannerDismiss";
import { getOrgId, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw, ORG_SETTINGS_UPDATED_EVENT } from "../utils/orgSettingsStorage";
import { syncOrgBrandingFromCloud } from "../utils/orgBrandingCloudSync";
import OrgModuleVisibility from "./OrgModuleVisibility";
import OrgWorkspaceProfile from "./OrgWorkspaceProfile";

export { getOrgSettings } from "../utils/orgSettingsStorage";

const ss = {
  ...ms,
  btn: { ...ms.btn, display:"inline-flex", alignItems:"center", gap:6 },
  btnP: { ...ms.btnP, display:"inline-flex", alignItems:"center", gap:6 },
  btnO: { ...ms.btnP, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", display:"inline-flex", alignItems:"center", gap:6 },
  card: { ...ms.card, marginBottom:16 },
  ta: { ...ms.inp, resize:"vertical", minHeight:60 },
  sec: { fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 },
};

function Section({ title, children }) {
  return (
    <div style={ss.card}>
      <div style={ss.sec}>{title}</div>
      {children}
    </div>
  );
}

function TabIntro({ children }) {
  return (
    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.55, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={ss.lbl}>{label}</label>
      {hint && <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginBottom:4 }}>{hint}</div>}
      {children}
    </div>
  );
}

export default function OrgSettings() {
  const { role, caps } = useApp();
  const { supabase } = useSupabaseAuth();
  const { pushToast } = useToast();
  const showDevHints = showAdminLoginHints();
  const [form, setForm] = useState(() => loadOrgSettingsRaw());
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("brand");
  const [roleSyncing, setRoleSyncing] = useState(false);
  const logoRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    const refresh = () => setForm(loadOrgSettingsRaw());
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener(ORG_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener(ORG_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const org = getOrgId();
    if (!org || org === "default") return;
    syncOrgBrandingFromCloud(supabase, org)
      .then((updated) => {
        if (updated) setForm(loadOrgSettingsRaw());
      })
      .catch(() => {});
  }, [supabase]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 500000) { alert("Logo must be under 500KB"); return; }
    const reader = new FileReader();
    reader.onload = ev => set("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  const persistSettings = async (next, auditAction) => {
    saveOrgSettingsRaw(next);
    const sectors = Array.isArray(next.industrySectors) ? next.industrySectors : [];
    if (!sectors.includes("pharma") && !sectors.includes("medical_devices")) {
      resetSectorBannerDismiss("pharma");
    }
    setForm(next);
    pushAudit({ action: auditAction, entity: "mysafeops_org_settings", detail: next.name || "" });
    if (supabase && caps.orgSettings) {
      try {
        const cloudAt = await pushOrgBrandingToCloud(supabase, next);
        if (cloudAt) saveOrgSettingsRaw(next, getOrgId(), cloudAt);
      } catch (e) {
        console.warn("Cloud branding sync failed:", e?.message || e);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSave = () => {
    if (!caps.orgSettings) {
      alert("Only administrators can change organisation settings.");
      return;
    }
    void persistSettings(form, "org_settings_save");
  };

  const addCustomField = () => {
    set("customFields", [...(form.customFields||[]), { id: Date.now(), label:"", value:"" }]);
  };

  const updateCustomField = (id, k, v) => {
    set("customFields", (form.customFields||[]).map(f=>f.id===id?{...f,[k]:v}:f));
  };

  const removeCustomField = (id) => {
    set("customFields", (form.customFields||[]).filter(f=>f.id!==id));
  };

  const TABS = [["brand","Branding & logo"],["company","Company info"],["sectors","Sectors"],["modules","Modules & RAMS"],["pdf","PDF defaults"],["custom","Custom fields"],["access","Access"],["preview","Preview"]];

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      <PageHero
        badgeText="ORG"
        title="Organisation settings"
        lead="Your logo and details appear on all printed documents and exports."
        right={
          <button
            type="button"
            onClick={handleSave}
            disabled={!caps.orgSettings}
            style={{ ...(saved ? { ...ss.btnP, background: "#27500A", borderColor: "#1D6B33" } : ss.btnP), opacity: caps.orgSettings ? 1 : 0.45 }}
          >
            {saved ? "Saved" : "Save settings"}
          </button>
        }
      />

      {/* tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:20, flexWrap:"wrap" }}>
        {TABS.map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            ...ss.btn, borderRadius:"6px 6px 0 0", padding:"6px 14px", fontSize:13,
            borderBottom:tab===t?"2px solid var(--color-accent,#0d9488)":"2px solid transparent",
            background:tab===t?"var(--color-background-secondary,#f7f7f5)":"transparent",
            borderLeft:"none", borderRight:"none", borderTop:"none",
            color:tab===t?"var(--color-accent-hover,#0f766e)":"var(--color-text-secondary)", fontWeight:tab===t?500:400,
          }}>{l}</button>
        ))}
      </div>

      {tab==="brand" && (
        <>
          <Section title="Logo">
            <div style={{ display:"flex", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
              {/* logo preview */}
              <div style={{
                width:140, height:80, borderRadius:8, flexShrink:0,
                border:"0.5px dashed var(--color-border-secondary,#ccc)",
                background:"var(--color-background-secondary,#f7f7f5)",
                display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
              }}>
                {form.logo
                  ? <img src={form.logo} alt="logo" style={{ maxWidth:132, maxHeight:72, objectFit:"contain" }} />
                  : <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>No logo</span>
                }
              </div>
              <div style={{ flex:1 }}>
                <Field label="Upload logo" hint="PNG, JPG or SVG — max 500KB. Will appear on all PDFs and the client portal.">
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>logoRef.current.click()} style={ss.btn}>Choose file</button>
                    {form.logo && <button onClick={()=>set("logo",null)} style={{ ...ss.btn, color:"#A32D2D", borderColor:"#F09595" }}>Remove logo</button>}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Brand colours">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))", gap:12 }}>
              <Field label="Primary colour" hint="Used for headers, key elements">
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <input type="color" value={form.primaryColor||"#0d9488"} onChange={e=>set("primaryColor",e.target.value)}
                    style={{ width:44, height:36, borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", cursor:"pointer", padding:2 }} />
                  <input value={form.primaryColor||"#0d9488"} onChange={e=>set("primaryColor",e.target.value)} style={{ ...ss.inp, width:"auto", flex:1 }} />
                </div>
              </Field>
              <Field label="Accent colour" hint="Used for buttons and highlights">
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <input type="color" value={form.accentColor||"#f97316"} onChange={e=>set("accentColor",e.target.value)}
                    style={{ width:44, height:36, borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", cursor:"pointer", padding:2 }} />
                  <input value={form.accentColor||"#f97316"} onChange={e=>set("accentColor",e.target.value)} style={{ ...ss.inp, width:"auto", flex:1 }} />
                </div>
              </Field>
            </div>
            {/* colour preview */}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <div style={{ padding:"6px 16px", borderRadius:6, background:form.primaryColor||"#0d9488", color:"#fff", fontSize:12 }}>Primary button</div>
              <div style={{ padding:"6px 16px", borderRadius:6, background:form.accentColor||"#f97316", color:"#fff", fontSize:12 }}>Accent button</div>
            </div>
          </Section>
        </>
      )}

      {tab==="sectors" && (
        <Section title="Industry sectors">
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.55 }}>
            Select the environments your teams work in. Tick every sector that matches your sites — banners, allergen notices and sector-specific registers follow your selection. Core construction tools stay available regardless.
          </div>
          {isTrialUnlockActive() && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#1E3A8A",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>Evaluation period:</strong> all sector modules are visible so you can explore. Banners and defaults only appear for sectors you tick below — they are not turned on automatically during trial.
            </div>
          )}
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--color-background-secondary,#f8fafc)",
              border: "1px solid var(--color-border-tertiary,#e2e8f0)",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <strong>Workspace profile vs sectors:</strong> the profile under <strong>Modules &amp; RAMS</strong> controls which modules and RAMS packs appear (e.g. survey + construction). Sector ticks here control industrial banners, register emphasis and food/pharma RAMS sections — they are independent.
          </div>
          {(() => {
            const selected = form.industrySectors || ["construction"];
            const hints = getSectorRegisterHints(selected);
            return (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--color-text-tertiary,#888)", marginBottom: 8 }}>
                  ACTIVE ({selected.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: hints.length ? 10 : 0 }}>
                  {selected.map((id) => (
                    <span
                      key={id}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                        color: "#065F46",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {getIndustrySectorLabel(id)}
                    </span>
                  ))}
                </div>
                {hints.length ? (
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                    <strong>Registers emphasised:</strong> {hints.join(" · ")} — enable in <strong>Modules & RAMS</strong> if hidden.
                  </div>
                ) : null}
              </div>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {INDUSTRY_SECTOR_GROUPS.map((group) => (
              <div key={group.id}>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{group.label}</div>
                  {group.description ? (
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{group.description}</div>
                  ) : null}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
                    gap: 10,
                  }}
                >
                  {group.options.map((opt) => {
                    const sectorSet = new Set(form.industrySectors || ["construction"]);
                    const checked = sectorSet.has(opt.id);
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: "flex",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          border: checked ? "1.5px solid #0d9488" : "1px solid var(--color-border-secondary,#e5e5e5)",
                          background: checked ? "#F0FDFA" : "var(--color-surface,#fff)",
                          boxShadow: checked ? "0 1px 3px rgba(13,148,136,0.08)" : "none",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(form.industrySectors || ["construction"]);
                            if (e.target.checked) next.add(opt.id);
                            else {
                              next.delete(opt.id);
                              if (next.size === 0) next.add("construction");
                            }
                            set("industrySectors", [...next]);
                          }}
                          style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: "#0d9488" }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.45 }}>
                            {opt.hint}
                          </div>
                          {opt.tags?.length ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                              {opt.tags.map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    letterSpacing: "0.03em",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "#F3F4F6",
                                    color: "#4B5563",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab==="modules" && (
        <>
          <TabIntro>
            <strong>Workflow:</strong> pick a <strong>workspace profile</strong> (playbooks + RAMS starters), then trim modules. Pair with <strong>Sectors</strong> for food/pharma registers and <strong>Settings → Automation</strong> for gates and survey/MS templates.
          </TabIntro>
          <Section title="Workspace profile">
            <OrgWorkspaceProfile />
          </Section>
          <Section title="Workspace modules">
            <OrgModuleVisibility />
          </Section>
        </>
      )}

      {tab==="company" && (
        <Section title="Company information">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))", gap:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="Company / organisation name">
                <input value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. Acme Construction Ltd" style={ss.inp} />
              </Field>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="Registered address">
                <textarea value={form.address||""} onChange={e=>set("address",e.target.value)} rows={2} placeholder="Full company address" style={ss.ta} />
              </Field>
            </div>
            <Field label="Phone">
              <input value={form.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="+44 ..." style={ss.inp} />
            </Field>
            <Field label="Email">
              <input value={form.email||""} onChange={e=>set("email",e.target.value)} placeholder="info@company.com" style={ss.inp} />
            </Field>
            <Field label="Website">
              <input value={form.website||""} onChange={e=>set("website",e.target.value)} placeholder="www.company.com" style={ss.inp} />
            </Field>
            <Field label="Default lead engineer">
              <input value={form.defaultLeadEngineer||""} onChange={e=>set("defaultLeadEngineer",e.target.value)} placeholder="Pre-fills lead engineer field on new documents" style={ss.inp} />
            </Field>
            <Field label="Company / registration number">
              <input value={form.registrationNo||""} onChange={e=>set("registrationNo",e.target.value)} placeholder="Companies House No." style={ss.inp} />
            </Field>
            <Field label="VAT number">
              <input value={form.vatNo||""} onChange={e=>set("vatNo",e.target.value)} placeholder="GB ..." style={ss.inp} />
            </Field>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="Emergency contact" hint="Printed on all documents">
                <input value={form.emergencyContact||""} onChange={e=>set("emergencyContact",e.target.value)} placeholder="Name, phone, role" style={ss.inp} />
              </Field>
            </div>
          </div>
        </Section>
      )}

      {tab==="pdf" && (
        <Section title="PDF document defaults">
          <TabIntro>
            Branding here flows to RAMS, permits, registers, surveys and briefings. Custom fields (separate tab) print under the header when they have a value. Automation gates live under <strong>Settings → Automation</strong>.
          </TabIntro>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8, letterSpacing: "0.04em" }}>HEADER & IDENTITY</div>
          <Field label="Document header text" hint="Appears below your logo on all printed documents">
            <input value={form.pdfHeader||""} onChange={e=>set("pdfHeader",e.target.value)}
              placeholder="e.g. Acme Construction Ltd — Health & Safety Documentation" style={ss.inp} />
          </Field>
          <Field label="Document footer text" hint="Appears at the bottom of every printed page">
            <input value={form.pdfFooter||""} onChange={e=>set("pdfFooter",e.target.value)}
              placeholder="e.g. Generated by MySafeOps — mysafeops.com" style={ss.inp} />
          </Field>
          <Field label="Date & time locale" hint="BCP-47 tag for permit dates and lists (e.g. en-GB, pl-PL). Leave blank to use the browser default.">
            <input
              value={form.locale || ""}
              onChange={(e) => set("locale", e.target.value)}
              placeholder="en-GB"
              style={ss.inp}
              autoComplete="off"
            />
          </Field>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", margin: "16px 0 8px", letterSpacing: "0.04em" }}>LAYOUT & COMPLIANCE</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))", gap:10 }}>
            <Field label="Document theme">
              <select value={form.pdfTheme || "executive"} onChange={(e)=>set("pdfTheme",e.target.value)} style={ss.inp}>
                <option value="executive">Executive</option>
                <option value="classic">Classic</option>
              </select>
            </Field>
            <Field label="Version prefix" hint="Used in visible revision labels (e.g. MSO, ACME, PTW).">
              <input value={form.pdfVersionPrefix||"MSO"} onChange={e=>set("pdfVersionPrefix",e.target.value)} placeholder="MSO" style={ss.inp} />
            </Field>
          </div>
          <Field label="Watermark text" hint="Optional large background text on PDF pages (e.g. Confidential).">
            <input value={form.pdfWatermarkText||""} onChange={e=>set("pdfWatermarkText",e.target.value)} placeholder="Confidential" style={ss.inp} />
          </Field>
          <Field label="Compliance line" hint="Appears in footer / integrity sections on permit and RAMS exports.">
            <input value={form.pdfComplianceLine||""} onChange={e=>set("pdfComplianceLine",e.target.value)} placeholder="Controlled document. Ensure latest approved revision is in use." style={ss.inp} />
          </Field>
          <Field label="Health & safety policy statement" hint="Optional — included in RAMS cover pages">
            <textarea value={form.safetyPolicy||""} onChange={e=>set("safetyPolicy",e.target.value)} rows={4}
              placeholder="It is the policy of [company] to ensure, so far as is reasonably practicable, the health, safety and welfare of all employees…" style={ss.ta} />
          </Field>
          {/* PDF preview box */}
          <div style={{ marginTop:16, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, overflow:"hidden" }}>
            <div style={{ background:"#f5f5f5", padding:"6px 12px", fontSize:11, color:"var(--color-text-secondary)" }}>PDF preview</div>
            <div style={{ padding:"16px", background:"#fff" }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, paddingBottom:12, borderBottom:"2px solid "+(form.primaryColor||"#0d9488"), marginBottom:10 }}>
                {form.logo
                  ? <img src={form.logo} alt="logo" style={{ height:44, maxWidth:120, objectFit:"contain" }} />
                  : <div style={{ width:80, height:44, background:"#f0f0f0", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#999" }}>LOGO</div>
                }
                <div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{form.name||"Your Company Name"}</div>
                  {form.pdfHeader && <div style={{ fontSize:11, color:"#666" }}>{form.pdfHeader}</div>}
                </div>
              </div>
              {(form.pdfWatermarkText || "").trim() ? (
                <div style={{ fontSize:10, color:"#999", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>
                  Watermark: {form.pdfWatermarkText}
                </div>
              ) : null}
              <div style={{ fontSize:10, color:"#666", marginBottom:6 }}>
                Theme: {(form.pdfTheme || "executive").toUpperCase()} · Version prefix: {form.pdfVersionPrefix || "MSO"}
              </div>
              <div style={{ fontSize:11, color:"#666", borderTop:"0.5px solid #e5e5e5", paddingTop:8, marginTop:8 }}>
                {form.pdfFooter||"Generated by MySafeOps — mysafeops.com"}
              </div>
              <div style={{ fontSize:10, color:"#888", marginTop:4 }}>
                {form.pdfComplianceLine || "Controlled document. Ensure latest approved revision is in use."}
              </div>
            </div>
          </div>
        </Section>
      )}

      {tab==="custom" && (
        <Section title="Custom fields">
          <TabIntro>
            Fields with a <strong>default value</strong> print under the document header on RAMS, registers, permits and surveys. Use for contract number, principal contractor, client contact — consistent across every export.
          </TabIntro>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {CUSTOM_FIELD_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                style={{ ...ss.btn, fontSize: 12 }}
                disabled={!caps.orgSettings}
                onClick={() => {
                  const exists = (form.customFields || []).some((f) => f.label === preset.label);
                  if (exists) return;
                  set("customFields", [...(form.customFields || []), { id: Date.now(), label: preset.label, value: preset.value, hint: preset.hint }]);
                }}
              >
                + {preset.label}
              </button>
            ))}
          </div>
          {(form.customFields||[]).map(f=>(
            <div key={f.id} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start", flexWrap:"wrap" }}>
              <input value={f.label} onChange={e=>updateCustomField(f.id,"label",e.target.value)}
                placeholder="Field label (e.g. Contract No.)" style={{ ...ss.inp, flex:1, minWidth:140 }} />
              <input value={f.value} onChange={e=>updateCustomField(f.id,"value",e.target.value)}
                placeholder="Default value (prints on PDF when set)" style={{ ...ss.inp, flex:1, minWidth:140 }} />
              <button onClick={()=>removeCustomField(f.id)} style={{ ...ss.btn, padding:"7px 10px", color:"#A32D2D", borderColor:"#F09595", flexShrink:0 }}>×</button>
              {f.hint ? <div style={{ width: "100%", fontSize: 11, color: "var(--color-text-tertiary)", marginTop: -4 }}>{f.hint}</div> : null}
            </div>
          ))}
          <button onClick={addCustomField} style={{ ...ss.btn, marginTop:4 }}>+ Add custom field</button>
        </Section>
      )}

      {tab==="access" && (
        <Section title="Your access level">
          <Field
            label="Membership role"
            hint="Admin: full access including organisation settings. Supervisor: no org settings or backup import. Operative: no deletes or bulk actions."
          >
            <div
              style={{
                padding: "11px 14px",
                borderRadius: "var(--radius-sm, 10px)",
                border: "1px solid var(--color-border-secondary,#cbd5e1)",
                background: "var(--color-background-secondary,#f8fafc)",
                fontSize: 14,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {role}
            </div>
          </Field>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            To change your role, ask an organisation admin to update membership in <strong>Settings → Invites / Members</strong>.
            Permissions refresh after the next cloud sync.
            {showDevHints ? " Admins can also edit roles in Supabase directly." : null}
          </p>
          <button
            type="button"
            style={ss.btnP}
            disabled={!supabase || roleSyncing}
            onClick={async () => {
              if (!supabase) return;
              setRoleSyncing(true);
              try {
                await refreshOrgFromSupabase(supabase);
                pushAudit({ action: "membership_role_refresh", entity: "org", detail: "ensure_my_org" });
                pushToast({ type: "success", message: "Role refreshed from cloud." });
              } catch (err) {
                pushToast({ type: "error", message: err?.message || "Could not refresh organisation from the cloud." });
              } finally {
                setRoleSyncing(false);
              }
            }}
          >
            {roleSyncing ? "Syncing…" : "Refresh role from cloud"}
          </button>
        </Section>
      )}

      {tab==="preview" && (
        <div style={{ ...ss.card }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, paddingBottom:14, borderBottom:"2.5px solid "+(form.primaryColor||"#0d9488"), marginBottom:14 }}>
            {form.logo
              ? <img src={form.logo} alt="logo" style={{ height:56, maxWidth:160, objectFit:"contain" }} />
              : <div style={{ width:100, height:56, background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--color-text-secondary)" }}>No logo</div>
            }
            <div>
              <div style={{ fontWeight:500, fontSize:16 }}>{form.name||"Your Company Name"}</div>
              {form.address && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>{form.address.split("\n")[0]}</div>}
              {form.phone && <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{form.phone} · {form.email}</div>}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
            {[["Primary",form.primaryColor||"#0d9488"],["Accent",form.accentColor||"#f97316"]].map(([l,c])=>(
              <div key={l} style={{ padding:"8px 12px", background:c, borderRadius:6, color:"#fff", fontSize:12 }}>{l}</div>
            ))}
          </div>
          {(form.customFields||[]).filter(f=>f.label).map(f=>(
            <div key={f.id} style={{ display:"flex", gap:8, fontSize:12, padding:"6px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
              <span style={{ color:"var(--color-text-secondary)", minWidth:140 }}>{f.label}</span>
              <span>{f.value||"—"}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
        <button
          onClick={handleSave}
          disabled={!caps.orgSettings}
          style={{ ...(saved ? { ...ss.btnP, background: "#27500A", borderColor: "#1D6B33" } : ss.btnP), opacity: caps.orgSettings ? 1 : 0.45 }}
        >
          {saved ? "Saved" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
