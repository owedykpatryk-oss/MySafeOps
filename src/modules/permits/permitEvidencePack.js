function hasValue(v) {
  if (typeof v === "number") return Number.isFinite(v);
  return String(v ?? "").trim().length > 0;
}

function csvEscape(s) {
  const t = String(s ?? "");
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

/**
 * Tabular export of the evidence pack (Excel-friendly). Mirrors {@link buildPermitEvidencePack}.
 * @returns {string} CSV with UTF-8 BOM
 */
export function buildEvidencePackCsv(permit, compliance, checklistItems = []) {
  const pack = buildPermitEvidencePack(permit, compliance, checklistItems);
  const rows = [];
  const push = (cols) => rows.push(cols.map(csvEscape).join(","));
  push(["section", "id", "label", "status", "detail"]);
  push(["meta", "generatedAt", "", "info", pack.generatedAt]);
  push(["meta", "matrixVersion", "", "info", pack.profile?.matrixVersion || ""]);
  push(["permit", "id", "", "info", pack.permit.id]);
  push(["permit", "type", "", "info", pack.permit.type]);
  push(["permit", "status", "", "info", pack.permit.status]);
  push(["permit", "location", "", "info", pack.permit.location]);
  push(["permit", "issuedTo", "", "info", pack.permit.issuedTo]);
  push(["permit", "issuedBy", "", "info", pack.permit.issuedBy]);
  push(["permit", "startDateTime", "", "info", pack.permit.startDateTime]);
  push(["permit", "endDateTime", "", "info", pack.permit.endDateTime]);
  (pack.profile?.legalReferences || []).forEach((ref, i) => {
    push(["legal_ref", String(i), "", "ref", ref]);
  });
  pack.checks.checklist.forEach((c) => {
    push(["checklist", c.id, c.label, c.ok ? "OK" : "MISSING", ""]);
  });
  pack.checks.evidence.forEach((e) => {
    push(["evidence", e.key, e.key, e.ok ? "OK" : "MISSING", String(e.value ?? "")]);
  });
  pack.checks.regulatory.forEach((r) => {
    push(["regulatory", r.id, r.label, r.ok ? "OK" : "MISSING", [r.framework, r.field].filter(Boolean).join(" · ")]);
  });
  push(["summary", "checklistOk", "", pack.summary.checklistOk ? "OK" : "FAIL", ""]);
  push(["summary", "evidenceOk", "", pack.summary.evidenceOk ? "OK" : "FAIL", ""]);
  push(["summary", "regulatoryOk", "", pack.summary.regulatoryOk ? "OK" : "FAIL", ""]);
  push(["summary", "legalReady", "", pack.summary.legalReady ? "OK" : "FAIL", ""]);
  push(["summary", "overallPass", "", pack.summary.overallPass ? "PASS" : "FAIL", ""]);
  return `\uFEFF${rows.join("\r\n")}`;
}

export function buildPermitEvidencePack(permit, compliance, checklistItems = []) {
  const checklistState = permit?.checklist || {};
  const profile = compliance?.profile || {};
  const legalChecklistIds = Array.isArray(profile.legalRequiredChecklistIds)
    ? profile.legalRequiredChecklistIds
    : [];
  const requiredEvidenceFields = Array.isArray(profile.requiredEvidenceFields)
    ? profile.requiredEvidenceFields
    : [];
  const legalRefs = Array.isArray(profile.legalReferences) ? profile.legalReferences : [];

  const checklistById = Object.fromEntries((checklistItems || []).map((item) => [item.id, item]));
  const checklistChecks = legalChecklistIds.map((id) => ({
    id,
    label: checklistById[id]?.text || id,
    ok: Boolean(checklistState[id]),
  }));
  const evidenceChecks = requiredEvidenceFields.map((key) => ({
    key,
    value: permit?.extraFields?.[key],
    ok: hasValue(permit?.extraFields?.[key]),
  }));
  const regulatoryChecks = Array.isArray(compliance?.regulatoryMatrix)
    ? compliance.regulatoryMatrix.map((row) => ({
        id: row.id,
        framework: row.framework,
        label: row.label,
        field: row.field,
        ok: Boolean(row.ok),
      }))
    : [];

  const checklistOk = checklistChecks.every((x) => x.ok);
  const evidenceOk = evidenceChecks.every((x) => x.ok);
  const regulatoryOk = regulatoryChecks.every((x) => x.ok);
  const legalReady = Boolean(compliance?.legalReady);

  return {
    generatedAt: new Date().toISOString(),
    permit: {
      id: permit?.id || "",
      type: permit?.type || "general",
      status: permit?.status || "draft",
      location: permit?.location || "",
      issuedTo: permit?.issuedTo || "",
      issuedBy: permit?.issuedBy || "",
      startDateTime: permit?.startDateTime || "",
      endDateTime: permit?.endDateTime || permit?.expiryDate || "",
    },
    profile: {
      matrixVersion: profile.matrixVersion || permit?.matrixVersion || "uk-v2",
      legalReferences: legalRefs,
    },
    checks: {
      checklist: checklistChecks,
      evidence: evidenceChecks,
      regulatory: regulatoryChecks,
    },
    summary: {
      checklistOk,
      evidenceOk,
      regulatoryOk,
      legalReady,
      overallPass: checklistOk && evidenceOk && regulatoryOk && legalReady,
    },
  };
}

