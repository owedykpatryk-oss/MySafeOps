import { useMemo, useState } from "react";
import { safeHttpUrl } from "../../utils/safeUrl.js";
import { compressImageFile } from "../../utils/geoPhotoUtils";
import {
  blankGprEvidence,
  GPR_AI_ACTIONS,
  GPR_AI_CAVEATS,
  GPR_AI_MECHANISMS,
  GPR_AI_RELEVANCE,
  GPR_EVIDENCE_KINDS,
  historicalResearchLinks,
  verifiedGprEvidence,
} from "./gprEvidence.js";
import {
  ARCHIVE_RING_METRES,
  archiveFrameDraft,
  gprSitePoint,
  loadArchiveFrames,
  loadNlsFrames,
} from "./gprHistoricImagery.js";
import GprArchiveComparison from "./GprArchiveComparison.jsx";

function EvidenceField({ label, children }) {
  return (
    <label className="app-gpr-field">
      <span className="app-gpr-field__label">{label}</span>
      {children}
    </label>
  );
}

function loadTile(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("tile failed"));
    image.src = url;
  });
}

async function markedFrameDataUrl(frame) {
  const image = await loadTile(frame.tileUrl);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const x = frame.marker.x * scale;
  const y = frame.marker.y * scale;
  const ring = Math.max(8, frame.ringPx * scale);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, ring, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 2;
  ctx.stroke();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function GprEvidencePanel({ report, project, busy, onChange, onRunAi, onAnnotateImage, inputStyle, textAreaStyle, buttonStyle }) {
  const [uploadingId, setUploadingId] = useState("");
  const [archiveFrames, setArchiveFrames] = useState([]);
  const [keptReleases, setKeptReleases] = useState([]);
  const [archiveStatus, setArchiveStatus] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const sitePoint = useMemo(() => gprSitePoint(report, project), [report, project]);
  const links = useMemo(() => historicalResearchLinks(report, project), [report, project]);
  const evidence = report?.historicalEvidence || [];
  const verified = verifiedGprEvidence(report);
  const assessments = report?.evidenceReview?.assessments || [];
  const byId = new Map(verified.map((item) => [item.id, item]));

  const update = (id, partial) => {
    onChange(evidence.map((item) => (item.id === id ? { ...item, ...partial } : item)));
  };

  const add = () => onChange([...evidence, blankGprEvidence()]);

  const loadArchive = async () => {
    if (!sitePoint) return;
    setArchiveStatus("loading");
    setArchiveError("");
    try {
      const [satellite, maps] = await Promise.all([
        loadArchiveFrames(sitePoint).catch(() => []),
        loadNlsFrames(sitePoint).catch(() => []),
      ]);
      const frames = [...maps, ...satellite];
      setArchiveFrames(frames);
      setKeptReleases([]);
      setArchiveStatus(frames.length ? "ready" : "empty");
    } catch (error) {
      setArchiveFrames([]);
      setArchiveStatus("");
      setArchiveError(error?.message || "Archive imagery could not be loaded.");
    }
  };

  const keepFrame = async (frame) => {
    setArchiveStatus(frame.release);
    try {
      const imageDataUrl = await markedFrameDataUrl(frame);
      onChange([...evidence, blankGprEvidence(archiveFrameDraft(frame, sitePoint, imageDataUrl))]);
      setKeptReleases((current) => [...current, frame.release]);
      setArchiveStatus("ready");
    } catch {
      setArchiveError("This frame could not be saved with the survey marker. It was not added.");
      setArchiveStatus("ready");
    }
  };

  const upload = async (item, file) => {
    if (!file) return;
    setUploadingId(item.id);
    try {
      const imageDataUrl = await compressImageFile(file, { maxWidth: 1600, quality: 0.8 });
      update(item.id, { imageDataUrl, imageFileName: file.name, originalImageDataUrl: "", annotations: [] });
    } finally {
      setUploadingId("");
    }
  };

  return (
    <section className="app-gpr-evidence">
      <div className="app-gpr-evidence__hero">
        <div>
          <span className="app-gpr-evidence__eyebrow">Evidence-backed site history</span>
          <h3>Historic maps, aerial imagery & previous land use</h3>
          <p>
            Record only what the cited source visibly or explicitly confirms. A historic building or burial ground is never
            inferred from AI alone; unverified items stay out of the AI review and the final factual summary.
          </p>
        </div>
        <div className="app-gpr-evidence__count"><strong>{verified.length}</strong><span>verified sources</span></div>
      </div>

      <div className="app-gpr-evidence__sources">
        {links.map((link) => (
          <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" title={link.note}>
            {link.label} ↗
          </a>
        ))}
      </div>
      <p className="app-gpr-evidence__hint">
        One click loads dated Esri satellite mosaics for this coordinate. The crosshair is the survey point and the ring is a {ARCHIVE_RING_METRES} m guide, not a legal boundary. Keep or discard each frame. A kept frame stays unverified until you confirm what the picture actually shows.
      </p>
      <div className="app-gpr-archive">
        <button type="button" className="app-gpr-ai-review-btn" disabled={!sitePoint || archiveStatus === "loading"} onClick={loadArchive}>
          {archiveStatus === "loading" ? "Loading archive frames…" : "Load historic satellite frames"}
        </button>
        {!sitePoint ? <span>Set a survey or project coordinate first.</span> : null}
        {archiveError ? <span className="app-gpr-archive__error">{archiveError}</span> : null}
        {archiveStatus === "empty" ? <span>No distinct archive frame was returned for this coordinate.</span> : null}
      </div>
      {archiveFrames.length ? (
        <GprArchiveComparison frames={archiveFrames} />
      ) : null}
      {archiveFrames.some((frame) => !keptReleases.includes(frame.release)) ? (
        <div className="app-gpr-archive-grid">
          {archiveFrames.filter((frame) => !keptReleases.includes(frame.release)).map((frame) => {
            const left = `${(frame.marker.x / 256) * 100}%`;
            const top = `${(frame.marker.y / 256) * 100}%`;
            const ring = Math.max(12, ((frame.ringPx * 2) / 256) * 100);
            const dates = frame.releaseDates.join(" · ");
            return (
              <article key={frame.release} className="app-gpr-archive-card">
                <div className="app-gpr-archive-card__map">
                  <img src={frame.tileUrl} alt={`World Imagery ${frame.releaseDates[0]}`} />
                  <span className="app-gpr-archive-card__ring" style={{ left, top, width: `${ring}%`, height: `${ring}%` }} />
                  <span className="app-gpr-archive-card__cross" style={{ left, top }} />
                </div>
                <strong>{frame.releaseDates[0]}</strong>
                <p>{dates === frame.releaseDates[0] ? "Distinct Wayback release" : `Same pixels in ${dates}`}</p>
                <div>
                  <button type="button" disabled={archiveStatus === frame.release} onClick={() => keepFrame(frame)}>Keep</button>
                  <button type="button" onClick={() => setArchiveFrames((current) => current.filter((item) => item.release !== frame.release))}>Discard</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {evidence.map((item, index) => (
        <div key={item.id} className={`app-gpr-evidence-card${item.verified ? " app-gpr-evidence-card--verified" : ""}`}>
          <div className="app-gpr-evidence-card__head">
            <strong>Evidence {index + 1}</strong>
            <button type="button" onClick={() => onChange(evidence.filter((x) => x.id !== item.id))}>Remove</button>
          </div>
          <div className="app-gpr-evidence-card__grid">
            <EvidenceField label="Source type">
              <select style={inputStyle} value={item.kind} onChange={(e) => update(item.id, { kind: e.target.value, verified: false })}>
                {GPR_EVIDENCE_KINDS.filter((x) => x.key !== "bgs_geology").map((kind) => <option key={kind.key} value={kind.key}>{kind.label}</option>)}
              </select>
            </EvidenceField>
            <EvidenceField label="Record / map title">
              <input style={inputStyle} value={item.title || ""} onChange={(e) => update(item.id, { title: e.target.value, verified: false })} />
            </EvidenceField>
            <EvidenceField label="Publisher / archive">
              <input style={inputStyle} value={item.sourceName || ""} onChange={(e) => update(item.id, { sourceName: e.target.value, verified: false })} />
            </EvidenceField>
            <EvidenceField label="Map / image / record date">
              <input style={inputStyle} value={item.sourceDate || ""} placeholder="e.g. surveyed 1896; published 1898" onChange={(e) => update(item.id, { sourceDate: e.target.value, verified: false })} />
            </EvidenceField>
          </div>
          <EvidenceField label="Permanent HTTPS source link">
            <input style={inputStyle} type="url" value={item.sourceUrl || ""} placeholder="https://…" onChange={(e) => update(item.id, { sourceUrl: e.target.value, verified: false })} />
          </EvidenceField>
          <EvidenceField label="Confirmed observation — fact only">
            <textarea
              style={textAreaStyle}
              rows={3}
              value={item.observedFact || ""}
              placeholder="Example: The 1898 OS sheet depicts a rectangular building footprint inside the current survey boundary."
              onChange={(e) => update(item.id, { observedFact: e.target.value, verified: false })}
            />
          </EvidenceField>
          <EvidenceField label="Coverage / alignment notes">
            <textarea style={textAreaStyle} rows={2} value={item.coverageNotes || ""} placeholder="How the historic feature was aligned to the current boundary; note uncertainty." onChange={(e) => update(item.id, { coverageNotes: e.target.value, verified: false })} />
          </EvidenceField>
          <div className="app-gpr-evidence-card__footer">
            <label className="app-gpr-evidence-upload">
              {uploadingId === item.id ? "Processing image…" : item.imageDataUrl ? "Replace evidence image" : "Add licensed screenshot/photo"}
              <input type="file" accept="image/*" onChange={(e) => upload(item, e.target.files?.[0])} />
            </label>
            {item.imageDataUrl ? <img src={item.imageDataUrl} alt="Evidence preview" /> : null}
            {item.imageDataUrl ? <button type="button" className="app-gpr-annotate-btn" onClick={() => onAnnotateImage?.(item)}>✎ Annotate image</button> : null}
            <label className="app-gpr-evidence-verify">
              <input
                type="checkbox"
                checked={item.verified === true}
                disabled={!item.observedFact?.trim() || !safeHttpUrl(item.sourceUrl)}
                onChange={(e) => update(item.id, {
                  verified: e.target.checked,
                  verifiedAt: e.target.checked ? new Date().toISOString() : "",
                })}
              />
              I checked this exact source, date, location and factual wording
            </label>
          </div>
        </div>
      ))}

      <div className="app-gpr-evidence__actions">
        <button type="button" style={buttonStyle} onClick={add}>+ Add historical evidence</button>
        <button type="button" className="app-gpr-ai-review-btn" disabled={busy || verified.length === 0} onClick={onRunAi}>
          {busy ? "Reviewing verified evidence…" : "AI: classify GPR relevance"}
        </button>
        <span>Hard limit: 2/min · 10/day · 100/30 days per signed-in user</span>
      </div>

      {assessments.length ? (
        <div className="app-gpr-evidence-results">
          <div className="app-gpr-evidence-results__meta">
            <strong>Controlled AI classification</strong>
            <span>
              {report.evidenceReview.model} · ${Number(report.evidenceReview.estimatedCostUsd || 0).toFixed(6)} · no web search · no generated site facts
            </span>
          </div>
          {assessments.map((assessment) => {
            const source = byId.get(assessment.evidenceId);
            if (!source) return null;
            return (
              <article key={assessment.evidenceId}>
                <div><strong>{source.title || source.sourceName || source.id}</strong><span>{GPR_AI_RELEVANCE[assessment.relevance]}</span></div>
                <p><b>Verified fact:</b> {source.observedFact}</p>
                <ul>
                  {(assessment.mechanisms || []).map((key) => <li key={key}>{GPR_AI_MECHANISMS[key]}</li>)}
                  {(assessment.recommendedActions || []).map((key) => <li key={key}>{GPR_AI_ACTIONS[key]}</li>)}
                </ul>
                <small>{GPR_AI_CAVEATS[assessment.caveat]}</small>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
