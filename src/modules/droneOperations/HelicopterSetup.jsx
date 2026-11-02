import { useState } from "react";
import { operatorDecisionFingerprint } from "./helicopterAssessment.js";

const fields = [
  ["operatorName", "Aviation operator"],
  ["certificateReference", "AWC number and verified scope reference"],
  ["pilotName", "Pilot in command"],
  ["aircraftRegistration", "Aircraft registration"],
  ["aircraftType", "Helicopter type"],
  ["sensorDescription", "Survey sensor and approved installation"],
  ["taskSpecialists", "Task specialists and duties"],
  ["operatorManualReference", "Operator manual and applicable procedures"],
  ["loadingReference", "Operator loading, fuel and maintenance confirmation"],
  ["landingPlan", "Landing and ground access plan"],
  ["communications", "Communications and stop-work arrangements"],
  ["remoteAreaPlan", "Remote-area assistance and overdue response"],
];
export default function HelicopterSetup({ mission, onChange, registers, canEdit }) {
  const h = mission.helicopter || {};
  const change = (key, value) => onChange({ helicopter: { ...h, [key]: value } });
  return (
    <section className="drone-card">
      <h2>Helicopter operator and survey team</h2>
      <p>
        Record the aviation operator's actual arrangements. This coordination record does not certify airworthiness or
        replace the operator's flight decision.
      </p>
      <fieldset disabled={!canEdit}>
        <div className="drone-fields">
          <label>
            Aviation service
            <select value={h.relationship || ""} onChange={(e) => change("relationship", e.target.value)}>
              <option value="">Select…</option>
              <option value="contracted">Contracted aviation operator</option>
              <option value="own">Our organisation is the aviation operator</option>
            </select>
          </label>
          <label>
            Survey lead from People
            <select value={mission.observerId || ""} onChange={(e) => onChange({ observerId: e.target.value })}>
              <option value="">Select…</option>
              {registers.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea value={h[key] || ""} onChange={(e) => change(key, e.target.value)} />
            </label>
          ))}
          {h.relationship === "own" && (
            <>
              <label>
                Organisation pilot from People
                <select value={mission.pilotId || ""} onChange={(e) => onChange({ pilotId: e.target.value })}>
                  <option value="">Select…</option>
                  {registers.workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Organisation aircraft record
                <select value={mission.assetId || ""} onChange={(e) => onChange({ assetId: e.target.value })}>
                  <option value="">Select…</option>
                  {registers.assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetRef} {a.description}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Operating pathway
            <select value={mission.category || ""} onChange={(e) => onChange({ category: e.target.value })}>
              <option value="">Select…</option>
              <option>CASA Part 138 aerial work — scope verified</option>
            </select>
          </label>
          <label>
            Planned maximum height (m)
            <input
              type="number"
              value={mission.heightM || ""}
              onChange={(e) => onChange({ heightM: e.target.value })}
            />
          </label>
          <label>
            Height reference
            <select value={mission.heightReference} onChange={(e) => onChange({ heightReference: e.target.value })}>
              {["AGL", "AMSL", "Above take-off — terrain review required"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
    </section>
  );
}
export function OperatorRelease({ mission, onSave, canEdit }) {
  const [form, setForm] = useState(() => ({
    by: mission.operatorRelease?.by || "",
    reference: mission.operatorRelease?.reference || "",
    conditions: mission.operatorRelease?.conditions || "",
    at: mission.operatorRelease?.at?.slice(0, 16) || new Date().toISOString().slice(0, 16),
    validUntil: mission.operatorRelease?.validUntil?.slice(0, 16) || "",
  }));
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <section className="drone-card">
      <h2>Aviation operator decision evidence</h2>
      <p>
        Record the decision provided by the named operator/pilot and a retrievable reference. This is an evidence
        record, not an electronic signature by that person. Complete it after the mission details and checks are
        settled.
      </p>
      <fieldset disabled={!canEdit}>
        <div className="drone-fields">
          {[
            ["by", "Operator / pilot who made the decision"],
            ["reference", "Operator decision reference"],
            ["at", "Decision recorded at (UTC)"],
            ["validUntil", "Decision valid until (UTC)"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={["at", "validUntil"].includes(key) ? "datetime-local" : "text"}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          <label className="drone-wide">
            Operator conditions and limitations
            <textarea value={form.conditions} onChange={(e) => set("conditions", e.target.value)} />
          </label>
        </div>
        <button
          style={{ marginTop: 16 }}
          onClick={() =>
            onSave({
              ...mission,
              approval: null,
              operatorRelease: {
                ...form,
                at: form.at ? `${form.at}:00Z` : "",
                validUntil: form.validUntil ? `${form.validUntil}:00Z` : "",
                missionRevision: mission.revision,
                missionFingerprint: operatorDecisionFingerprint(mission),
              },
              updatedAt: new Date().toISOString(),
            })
          }
        >
          Record operator decision
        </button>
      </fieldset>
      {mission.operatorRelease && (
        <p>
          Decision evidence saved for revision {mission.operatorRelease.missionRevision}. Readiness checks its dates and
          completeness.
        </p>
      )}
    </section>
  );
}
