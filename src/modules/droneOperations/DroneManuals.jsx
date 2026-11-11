import { useEffect, useState } from "react";
import { countryOperationalStorageKey } from "../../utils/orgStorage.js";
import { manualSections, regionalSources, regionOf, kindOf } from "./droneRegions.js";
import { createCompanyManual, manualReview, manualOutline, updateManual, MANUAL_TOPICS } from "./companyManual.js";
import { compareManualRevision, manualReviewQueue } from "./manualAutomation.js";
import { ManualReviewQueue, ManualAutomationTools } from "./ManualAutomation.jsx";

// Keep failed writes across SPA navigation without retrying a failed storage device.
// Scope by organisation, country, region and signed-in user; clear on save/discard.
const pendingManualEdits = new Map();

export default function DroneManuals({
  manuals,
  onSave,
  canEdit,
  actor,
  onExport,
  regionCode = "uk",
  companySettings = {},
}) {
  const recoveryKey = `${countryOperationalStorageKey("drone_manuals")}:${regionCode}:${actor.id || "local"}`;
  const [selected, setSelected] = useState(() => pendingManualEdits.get(recoveryKey)?.value.id || ""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(() => pendingManualEdits.get(recoveryKey) || null),
    [savedAt, setSavedAt] = useState(""),
    [openChapterId, setOpenChapterId] = useState(null);
  const stored = manuals.find((m) => m.id === selected && regionOf(m) === regionCode);
  const manual = pending?.value || stored;
  const sections = manualSections(manual || { regionCode, aircraftKind: regionCode === "au" ? "helicopter" : "drone" });
  const sources = regionalSources(
    manual || { regionCode, aircraftKind: regionCode === "au" ? "helicopter" : "drone" }
  ).filter((s) => s.kind !== "manufacturer");
  const review = manual ? manualReview(manual) : null;
  const locked = !!manual?.approvedAt;
  const visibleManuals = manuals.filter((m) => regionOf(m) === regionCode);
  const comparison = manual
    ? (locked && manual.amendmentComparison) ||
      compareManualRevision(
        manual,
        manuals.find((m) => m.id === manual.previousId)
      )
    : null;
  const timing = manual && manualReviewQueue(visibleManuals).find((item) => item.manual.id === manual.id);
  useEffect(() => {
    if (!pending) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  function saveValue(value, base = pending?.base || stored) {
    try {
      const saved = onSave(value, base);
      if (!saved) throw new Error("Save failed. Keep this page open and retry.");
      pendingManualEdits.delete(recoveryKey);
      setPending(null);
      setError("");
      setSavedAt(new Date().toISOString());
      return saved;
    } catch (e) {
      const retained = { ...value };
      if (!base?.approvedAt) {
        delete retained.approvedAt;
        delete retained.approvedBy;
        delete retained.approvedUserId;
        if (value.approvedAt) delete retained.branding;
      }
      const recovery = { value: retained, base };
      pendingManualEdits.set(recoveryKey, recovery);
      setPending(recovery);
      setError(e.message);
      return null;
    }
  }
  function update(patch) {
    try {
      return saveValue(updateManual(manual, patch));
    } catch (e) {
      setError(e.message);
      return null;
    }
  }
  function create(previous) {
    try {
      const next = createCompanyManual(companySettings, actor, regionCode, previous);
      if (!onSave(next, null)) throw new Error("The new manual could not be saved. Please retry.");
      setSelected(next.id);
      pendingManualEdits.delete(recoveryKey);
      setPending(null);
      setSavedAt(new Date().toISOString());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function approve() {
    if (review.issues.length) {
      setError("Complete the scope, company details, version, change record and every section review before review.");
      return;
    }
    const at = new Date().toISOString();
    saveValue({
      ...manual,
      approvedAt: at,
      approvedBy: actor.name,
      approvedUserId: actor.id || null,
      updatedAt: at,
      branding: { name: manual.company?.name || companySettings.name, logo: companySettings.logo || null },
      amendmentComparison: comparison,
    });
  }
  function jump(key) {
    const node = document.getElementById(`manual-${key}`);
    if (node?.tagName === "DETAILS") node.open = true;
    node?.scrollIntoView({ behavior: "auto", block: "center" });
    node?.querySelector("input,textarea,select")?.focus({ preventScroll: true });
  }
  const field = (key, label, type = "text") => (
    <label id={`manual-${key}`}>
      {label}
      <input type={type} value={manual[key] || ""} onChange={(e) => update({ [key]: e.target.value })} />
    </label>
  );
  return (
    <section className="company-manual-workspace">
      <div className="drone-toolbar">
        <div>
          <h2>Operations Manuals</h2>
          <p>Your company procedures, controlled versions and a document your team can use.</p>
        </div>
        {canEdit && (
          <button type="button" className="drone-primary" disabled={!!pending} onClick={() => create()}>
            New manual
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="drone-error">
          {error}
        </p>
      )}
      <ManualReviewQueue
        manuals={visibleManuals}
        disabled={!!pending}
        onSelect={(id) => {
          setSelected(id);
          setError("");
          setSavedAt("");
        }}
      />
      <label className="manual-version-picker">
        Manual version
        <select
          value={selected}
          disabled={!!pending}
          onChange={(e) => {
            setSelected(e.target.value);
            setError("");
            setSavedAt("");
          }}
        >
          <option value="">Select a manual</option>
          {manuals
            .filter((m) => regionOf(m) === regionCode)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.version} · {kindOf(m)} · {m.approvedAt ? "Reviewed" : "Draft"}
              </option>
            ))}
        </select>
      </label>
      {!manual && (
        <div className="manual-empty">
          <h3>Build your company’s operating handbook</h3>
          <p>
            Start with company details, work through ten procedure chapters, then record the responsible person’s
            review. Save drafts as you go and export a branded PDF at any stage.
          </p>
          <div className="manual-stage-row">
            <span>Company & scope</span>
            <span>Procedures & evidence</span>
            <span>Review & controlled PDF</span>
          </div>
        </div>
      )}
      {manual && (
        <>
          <div className="manual-hero">
            <div>
              <p className="manual-status-label">{locked ? "Reviewed company version" : "Company working draft"}</p>
              <h3>{manual.title}</h3>
              <p>{manual.company?.name || "Add your company details"}</p>
              <small>
                {kindOf(manual) === "helicopter"
                  ? "Survey coordination • aviation operator procedures remain separate"
                  : "Drone operations • adapt procedures to your operating pathway"}
              </small>
              {locked && timing && <p className={`manual-timing ${timing.status}`}>{timing.label}</p>}
            </div>
            <div className="manual-progress">
              <strong>
                {review.drafted} / {review.total}
              </strong>
              <span>chapters drafted</span>
              <progress value={review.drafted} max={review.total} aria-label="Manual drafting progress" />
              <small>{review.reviewed} chapter reviews recorded</small>
            </div>
          </div>
          <div className="manual-save-bar">
            <span role="status">
              {pending
                ? "Unsaved changes — keep this page open"
                : savedAt
                  ? `Saved on this device at ${new Date(savedAt).toLocaleTimeString()}`
                  : "Stored company manual"}
              <small>Cloud synchronization status is shown above.</small>
            </span>
            <div className="drone-actions">
              {!locked && canEdit && (
                <button type="button" className="drone-primary" onClick={() => saveValue(manual)}>
                  Save company manual
                </button>
              )}
              {pending && (
                <button
                  type="button"
                  onClick={() => {
                    pendingManualEdits.delete(recoveryKey);
                    setPending(null);
                    setError("");
                  }}
                >
                  Discard unsaved edits
                </button>
              )}
              <button
                type="button"
                disabled={!!pending}
                onClick={() => onExport(locked ? manual : { ...manual, amendmentComparison: comparison })}
              >
                Download manual PDF
              </button>
            </div>
          </div>
          {locked && (
            <p className="drone-note">
              Reviewed by {manual.approvedBy} on {manual.approvedAt}. This version is locked; create a revision to amend
              it.
            </p>
          )}
          <div className="manual-work-grid">
            <div>
              <ManualAutomationTools
                manual={manual}
                companySettings={companySettings}
                comparison={comparison}
                canEdit={canEdit}
                onUpdate={update}
              />
              <section className="drone-card">
                <h3>Company & document control</h3>
                <fieldset disabled={!canEdit || locked}>
                  <div className="drone-fields">
                    <label id="manual-company">
                      Company legal name
                      <input
                        aria-label="Company legal name"
                        value={manual.company?.name || ""}
                        onChange={(e) => update({ company: { ...manual.company, name: e.target.value } })}
                      />
                    </label>
                    {field("documentCode", "Document code")}
                    {field("documentOwner", "Document owner")}
                    {field("accountableManager", "Accountable manager")}
                    {field("reviewDue", "Next review date", "date")}
                    <label>
                      Company registration / ABN
                      <input
                        value={manual.company?.registrationNo || ""}
                        onChange={(e) => update({ company: { ...manual.company, registrationNo: e.target.value } })}
                      />
                    </label>
                    <label>
                      Company address
                      <input
                        value={manual.company?.address || ""}
                        onChange={(e) => update({ company: { ...manual.company, address: e.target.value } })}
                      />
                    </label>
                    <label>
                      Company email
                      <input
                        type="email"
                        value={manual.company?.email || ""}
                        onChange={(e) => update({ company: { ...manual.company, email: e.target.value } })}
                        placeholder="ops@company.com"
                      />
                    </label>
                    <label>
                      Company phone
                      <input
                        value={manual.company?.phone || ""}
                        onChange={(e) => update({ company: { ...manual.company, phone: e.target.value } })}
                        placeholder="+44 …"
                      />
                    </label>
                    {regionCode === "au" && (
                      <label>
                        Document applicability
                        <select
                          disabled={Object.values(manual.sections || {}).some((value) => String(value).trim())}
                          value={kindOf(manual)}
                          onChange={(e) => update({ aircraftKind: e.target.value, sections: {}, sectionReviews: {} })}
                        >
                          <option value="drone">Australia — drone operator procedures</option>
                          <option value="helicopter">Australia — helicopter survey coordination</option>
                        </select>
                      </label>
                    )}
                    {field("title", "Title")}
                    {field("version", "Version")}
                    <label className="drone-wide" id="manual-scope">
                      Operating scope and pathway
                      <textarea value={manual.scope || ""} onChange={(e) => update({ scope: e.target.value })} />
                    </label>
                    <label className="drone-wide" id="manual-changeNote">
                      Amendment record
                      <textarea
                        value={manual.changeNote || ""}
                        onChange={(e) => update({ changeNote: e.target.value })}
                      />
                    </label>
                    <label className="drone-wide">
                      Controlled distribution
                      <textarea
                        placeholder="Roles or teams receiving this version; briefing and withdrawal arrangements."
                        value={manual.distribution || ""}
                        onChange={(e) => update({ distribution: e.target.value })}
                      />
                    </label>
                    <label className="drone-wide">
                      Supporting documents and references
                      <textarea
                        placeholder="Document title, owner, version, reference / location and applicability."
                        value={manual.references || ""}
                        onChange={(e) => update({ references: e.target.value })}
                      />
                    </label>
                  </div>
                </fieldset>
              </section>
              <section className="drone-card manual-chapters">
                <div className="drone-toolbar">
                  <div>
                    <h3>Company procedures</h3>
                    <p>Write the actual procedure, responsibilities and evidence for your operation.</p>
                  </div>
                  {canEdit && !locked && (
                    <button type="button" onClick={() => update(manualOutline(manual))}>
                      Add outlines to empty chapters
                    </button>
                  )}
                </div>
                <fieldset disabled={!canEdit || locked}>
                  {sections.map((s, index) => (
                    <details
                      key={s.id}
                      id={`manual-${s.id}`}
                      open={openChapterId === s.id}
                      onToggle={(event) => setOpenChapterId(event.currentTarget.open ? s.id : null)}
                    >
                      <summary>
                        <span className="manual-chapter-number">{String(index + 1).padStart(2, "0")}</span>
                        <span>
                          {s.title}
                          <small>
                            {manual.sectionReviews?.[s.id]
                              ? "Review recorded"
                              : manual.sections?.[s.id]
                                ? "Draft in progress"
                                : "Needs input"}
                          </small>
                        </span>
                      </summary>
                      <ul className="manual-topic-list">
                        {MANUAL_TOPICS[s.id].map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                      <label>
                        {s.prompt}
                        <textarea
                          value={manual.sections?.[s.id] || ""}
                          onChange={(e) => update({ sections: { ...manual.sections, [s.id]: e.target.value } })}
                        />
                      </label>
                      <label className="manual-chapter-check">
                        <input
                          type="checkbox"
                          checked={!!manual.sectionReviews?.[s.id]}
                          disabled={
                            !manual.sections?.[s.id]?.trim() ||
                            /\[TO COMPLETE[:\]]/i.test(manual.sections?.[s.id] || "")
                          }
                          onChange={(e) =>
                            update({
                              sectionReviews: {
                                ...manual.sectionReviews,
                                [s.id]: e.target.checked ? { by: actor.name, at: new Date().toISOString() } : null,
                              },
                            })
                          }
                        />
                        I have checked this chapter against our company’s actual procedures.
                      </label>
                    </details>
                  ))}
                </fieldset>
              </section>
            </div>
            <aside className="drone-card manual-review-aside">
              <h3>Document readiness</h3>
              <p>{review.issues.length} item(s) to review</p>
              {review.issues.length > 0 && (
                <button type="button" onClick={() => jump(review.issues[0].key)}>
                  Continue next item
                </button>
              )}
              <ul>
                {review.issues.slice(0, 6).map((issue, i) => (
                  <li key={`${issue.key}-${i}`}>
                    <button type="button" onClick={() => jump(issue.key)}>
                      {issue.text}
                    </button>
                  </li>
                ))}
              </ul>
              {review.issues.length > 6 && <p className="drone-note">{review.issues.length - 6} more items remain.</p>}
              <p className="drone-note">
                Drafting progress measures recorded content. Company review does not grant aviation certification or
                permission to fly.
              </p>
              {canEdit && !locked && (
                <button type="button" className="drone-primary" disabled={!!pending} onClick={approve}>
                  Record responsible person review
                </button>
              )}
              {canEdit && locked && (
                <button type="button" onClick={() => create(manual)}>
                  Create revision
                </button>
              )}
            </aside>
          </div>
        </>
      )}
      <details className="manual-source-notes">
        <summary>Source guidance and applicability</summary>
        <p>
          Adapt the manual to your actual operating pathway. A survey coordination plan does not replace the aviation
          operator’s approved manuals.
        </p>
        {sources.map((s) => (
          <p key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>{" "}
            · Source checked {s.verifiedOn}
          </p>
        ))}
      </details>
    </section>
  );
}
