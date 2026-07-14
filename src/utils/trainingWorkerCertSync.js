import { certLabel, getCertLibraryForMarket, normalizeWorkerCertifications } from "./certifications";
import { getOrgMarketId } from "./orgMarket";

/**
 * Best-effort map from free-text training course name to a cert library code.
 */
export function matchTrainingCourseToCertCode(courseName, marketId = getOrgMarketId()) {
  const hay = String(courseName || "").trim().toLowerCase();
  if (!hay) return null;

  const library = getCertLibraryForMarket(marketId);
  let best = null;
  let bestScore = 0;

  library.forEach((entry) => {
    const code = String(entry.code || "").toLowerCase();
    const label = String(entry.label || "").toLowerCase();
    let score = 0;
    if (hay === code || hay === label) score = 100;
    else if (hay.includes(code) && code.length >= 3) score = 80;
    else if (label && hay.includes(label)) score = 70;
    else {
      const tokens = label.split(/[\s/(),-]+/).filter((t) => t.length >= 4);
      const hits = tokens.filter((t) => hay.includes(t)).length;
      if (hits > 0) score = 40 + hits * 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry.code;
    }
  });

  return bestScore >= 40 ? best : null;
}

export function buildCertFromTrainingRecord(record, marketId = getOrgMarketId()) {
  const courseName = String(record?.courseName || "").trim();
  if (!courseName) return { ok: false, reason: "missing_course" };

  const certCode = matchTrainingCourseToCertCode(courseName, marketId);
  const certType = certCode ? certLabel(certCode, marketId) : courseName;
  const expiryDate = String(record?.expiryDate || "").slice(0, 10);

  return {
    ok: true,
    cert: {
      certCode: certCode || courseName.toLowerCase().replace(/\s+/g, "_").slice(0, 48),
      certType,
      expiryDate,
      provider: String(record?.provider || "").trim(),
      certNumber: "",
      sourceTrainingId: record?.id || null,
    },
    matchedLibrary: Boolean(certCode),
  };
}

/**
 * Merge one training record into a worker's certifications (updates expiry if same code).
 */
export function mergeTrainingIntoWorker(worker, trainingRecord, marketId = getOrgMarketId()) {
  const built = buildCertFromTrainingRecord(trainingRecord, marketId);
  if (!built.ok) return { worker, changed: false, reason: built.reason };

  const certs = normalizeWorkerCertifications(worker);
  const codeKey = String(built.cert.certCode || "").toLowerCase();
  const idx = certs.findIndex((c) => String(c.certCode || c.certType || "").toLowerCase() === codeKey);
  const nextCert = { ...built.cert };

  let nextCerts;
  if (idx >= 0) {
    nextCerts = certs.map((c, i) => (i === idx ? { ...c, ...nextCert } : c));
  } else {
    nextCerts = [...certs, nextCert];
  }

  return {
    worker: { ...worker, certifications: nextCerts },
    changed: true,
    matchedLibrary: built.matchedLibrary,
    certType: nextCert.certType,
  };
}

/**
 * Apply one training record to the workers array; returns { workers, result }.
 */
export function syncTrainingRecordToWorkers(workers, trainingRecord, marketId = getOrgMarketId()) {
  const workerId = String(trainingRecord?.workerId || "").trim();
  if (!workerId) return { workers, ok: false, reason: "missing_worker" };
  if (!String(trainingRecord?.expiryDate || "").trim()) {
    return { workers, ok: false, reason: "missing_expiry" };
  }

  let result = { ok: false, reason: "worker_not_found" };
  const next = workers.map((w) => {
    if (w.id !== workerId) return w;
    const merged = mergeTrainingIntoWorker(w, trainingRecord, marketId);
    result = merged.changed
      ? { ok: true, workerId, certType: merged.certType, matchedLibrary: merged.matchedLibrary }
      : { ok: false, reason: merged.reason || "unchanged" };
    return merged.worker;
  });

  return { workers: next, ...result };
}

/** Bulk sync all training rows that have worker + expiry. */
export function syncAllTrainingToWorkers(workers, trainingRecords = [], marketId = getOrgMarketId()) {
  let current = workers;
  let synced = 0;
  let skipped = 0;
  const details = [];

  trainingRecords.forEach((record) => {
    const out = syncTrainingRecordToWorkers(current, record, marketId);
    if (out.ok) {
      current = out.workers;
      synced += 1;
      details.push({ id: record.id, certType: out.certType });
    } else {
      skipped += 1;
    }
  });

  return { workers: current, synced, skipped, details };
}
