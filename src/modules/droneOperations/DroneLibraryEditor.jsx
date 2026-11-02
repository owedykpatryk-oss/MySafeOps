import { useState } from "react";
import { droneId } from "./droneMission.js";
const capabilities = ["rgb", "photogrammetry", "lidar", "thermal"];
export default function DroneLibraryEditor({ entries, onAdd, payloads, actor, canEdit }) {
  const empty = {
    kind: "profile",
    aircraftKind: "drone",
    name: "",
    version: "1.0",
    url: "",
    note: "",
    capabilities: [],
    payloadIds: [],
    phase: "planning",
    role: "Remote pilot",
  };
  const [form, setForm] = useState(empty),
    [error, setError] = useState("");
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  function save() {
    let url;
    try {
      url = new URL(form.url);
    } catch {
      setError("Add a source URL.");
      return;
    }
    if (
      url.protocol !== "https:" ||
      !form.name.trim() ||
      !form.note.trim() ||
      !form.version.trim() ||
      (form.kind === "profile" && !form.payloadIds.length) ||
      (["payload", "template"].includes(form.kind) && !form.capabilities.length)
    ) {
      setError("Complete the title, version, HTTPS source, review notes and applicable payloads / capabilities.");
      return;
    }
    const id = `org-${droneId()}`,
      date = new Date().toISOString();
    onAdd({
      ...form,
      id,
      createdAt: date,
      approvedAt: date,
      approvedBy: actor.name,
      approvedUserId: actor.id,
      source: {
        title: form.name,
        url: url.toString(),
        verifiedOn: date.slice(0, 10),
        kind: "organisation-reviewed source",
      },
      required: form.note,
      limitations: "Organisation profile: review the cited source, actual configuration and mission suitability.",
      notSupported: "Capabilities not explicitly listed",
      capability: form.capabilities[0],
      qa: form.note,
      deliverables: form.name,
      stage: form.name,
      text: form.note,
    });
    setForm(empty);
    setError("");
  }
  return (
    <section className="drone-card">
      <h2>Organisation library</h2>
      <p>
        Add reviewed model profiles, payloads, mission templates or checklist items without changing code. Each entry is
        a new, retained version. Manufacturer evidence and organisation review remain distinct.
      </p>
      {entries.map((e) => (
        <div key={e.id} className="drone-evidence">
          <strong>
            {e.name} · {e.kind} · {e.version}
          </strong>
          <p>{e.note}</p>
          <small>
            Reviewed by {e.approvedBy} · {e.approvedAt} ·{" "}
            <a href={e.source.url} target="_blank" rel="noreferrer">
              Source
            </a>
          </small>
        </div>
      ))}
      {canEdit && (
        <details>
          <summary>Add reviewed library version</summary>
          <fieldset>
            <div className="drone-fields">
              <label>
                Entry type
                <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
                  {["profile", "payload", "template", "checklist"].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label>
                Version
                <input value={form.version} onChange={(e) => set("version", e.target.value)} />
              </label>
              <label>
                Official or organisation source URL
                <input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} />
              </label>
              <label className="drone-wide">
                Reviewed requirements, limitations or procedure
                <textarea value={form.note} onChange={(e) => set("note", e.target.value)} />
              </label>
            </div>
            {form.kind === "profile" && (
              <div className="drone-fields" style={{ marginTop: 16 }}>
                {payloads.map((p) => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      checked={form.payloadIds.includes(p.id)}
                      onChange={(e) =>
                        set(
                          "payloadIds",
                          e.target.checked ? [...form.payloadIds, p.id] : form.payloadIds.filter((id) => id !== p.id)
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            {["profile", "payload", "template"].includes(form.kind) && (
              <div className="drone-actions" style={{ marginTop: 16 }}>
                {capabilities.map((c) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={form.capabilities.includes(c)}
                      onChange={(e) =>
                        set(
                          "capabilities",
                          e.target.checked ? [...form.capabilities, c] : form.capabilities.filter((x) => x !== c)
                        )
                      }
                    />
                    {c}
                  </label>
                ))}
              </div>
            )}
            {form.kind === "template" && (
              <p>The first selected capability is the required capability for this template.</p>
            )}
            {form.kind === "checklist" && (
              <div className="drone-fields">
                <label>
                  Aircraft applicability
                  <select value={form.aircraftKind} onChange={(e) => set("aircraftKind", e.target.value)}>
                    <option value="drone">Drone / RPAS</option>
                    <option value="helicopter">Helicopter survey coordination</option>
                  </select>
                </label>
                <label>
                  Phase
                  <select value={form.phase} onChange={(e) => set("phase", e.target.value)}>
                    {["planning", "site", "flight", "post"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Responsible role
                  <input value={form.role} onChange={(e) => set("role", e.target.value)} />
                </label>
              </div>
            )}
            {error && (
              <p role="alert" className="drone-error">
                {error}
              </p>
            )}
            <button className="drone-primary" onClick={save} style={{ marginTop: 18 }}>
              Save reviewed version
            </button>
          </fieldset>
        </details>
      )}
    </section>
  );
}
