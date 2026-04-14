function cleanText(v) {
  return String(v || "").trim();
}

function toIso(ms) {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

export function normalizeShiftHours(shiftHours) {
  const hours = Array.isArray(shiftHours)
    ? shiftHours
        .map((h) => Number(h))
        .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23)
    : [];
  const unique = Array.from(new Set(hours));
  return unique.length > 0 ? unique.sort((a, b) => a - b) : [6, 18];
}

export function normalizePermitHandoverLog(log) {
  if (!Array.isArray(log)) return [];
  return log
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: cleanText(row.id) || `handover_${Math.random().toString(36).slice(2, 8)}`,
      submittedAt: cleanText(row.submittedAt),
      shiftBoundaryAt: cleanText(row.shiftBoundaryAt),
      whatChanged: cleanText(row.whatChanged),
      remainingHighRisk: cleanText(row.remainingHighRisk),
      criticalControlsConfirmed: row.criticalControlsConfirmed === true,
      outgoingSupervisor: cleanText(row.outgoingSupervisor),
      incomingSupervisor: cleanText(row.incomingSupervisor),
      outgoingAcknowledgedAt: cleanText(row.outgoingAcknowledgedAt),
      incomingAcknowledgedAt: cleanText(row.incomingAcknowledgedAt),
    }));
}

export function isCompleteHandoverEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  return Boolean(
    cleanText(entry.whatChanged) &&
      cleanText(entry.remainingHighRisk) &&
      entry.criticalControlsConfirmed === true &&
      cleanText(entry.outgoingSupervisor) &&
      cleanText(entry.incomingSupervisor) &&
      cleanText(entry.outgoingAcknowledgedAt) &&
      cleanText(entry.incomingAcknowledgedAt)
  );
}

export function latestCompletedHandover(log) {
  const rows = normalizePermitHandoverLog(log).filter((row) => isCompleteHandoverEntry(row));
  if (rows.length === 0) return null;
  return rows
    .slice()
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())[0];
}

function shiftBoundariesBetween(startMs, endMs, shiftHours) {
  const validHours = normalizeShiftHours(shiftHours);
  const out = [];
  const cursor = new Date(startMs);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(endMs);
  endDate.setHours(23, 59, 59, 999);
  while (cursor.getTime() <= endDate.getTime()) {
    validHours.forEach((hour) => {
      const mark = new Date(cursor);
      mark.setHours(hour, 0, 0, 0);
      const ms = mark.getTime();
      if (ms > startMs && ms <= endMs) out.push(ms);
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function evaluatePermitHandoverRequirement(permit, now = new Date(), options = {}) {
  const derivedStatus = cleanText(options.derivedStatus || permit?.status || "").toLowerCase();
  if (derivedStatus !== "active" && derivedStatus !== "issued") {
    return { required: false, missing: false, lastBoundaryAt: "", lastCompletedAt: "", reason: "" };
  }
  const startMs = new Date(permit?.startDateTime || "").getTime();
  if (!Number.isFinite(startMs)) {
    return { required: false, missing: false, lastBoundaryAt: "", lastCompletedAt: "", reason: "" };
  }
  const nowMs = now instanceof Date ? now.getTime() : new Date(now || Date.now()).getTime();
  const endCandidate = new Date(permit?.endDateTime || permit?.expiryDate || "").getTime();
  const windowEnd = Number.isFinite(endCandidate) ? Math.min(endCandidate, nowMs) : nowMs;
  if (!Number.isFinite(windowEnd) || windowEnd <= startMs) {
    return { required: false, missing: false, lastBoundaryAt: "", lastCompletedAt: "", reason: "" };
  }
  const boundaries = shiftBoundariesBetween(startMs, windowEnd, options.shiftHours);
  if (boundaries.length === 0) {
    return { required: false, missing: false, lastBoundaryAt: "", lastCompletedAt: "", reason: "" };
  }
  const lastBoundaryMs = Math.max(...boundaries);
  const completed = latestCompletedHandover(permit?.handoverLog || []);
  const completedMs = completed?.submittedAt ? new Date(completed.submittedAt).getTime() : NaN;
  const missing = !Number.isFinite(completedMs) || completedMs < lastBoundaryMs;
  return {
    required: true,
    missing,
    lastBoundaryAt: toIso(lastBoundaryMs),
    lastCompletedAt: Number.isFinite(completedMs) ? toIso(completedMs) : "",
    reason: missing ? "Shift boundary passed without full handover acknowledgements." : "",
  };
}
