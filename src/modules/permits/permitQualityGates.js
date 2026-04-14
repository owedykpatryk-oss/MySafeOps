function isRequired(requiredMap, key, fallback = true) {
  if (!requiredMap || typeof requiredMap !== "object") return fallback;
  if (requiredMap[key] == null) return fallback;
  return Boolean(requiredMap[key]);
}

function cleanText(value) {
  return String(value || "").trim();
}

function containsAny(haystack, needles = []) {
  const h = String(haystack || "").toLowerCase();
  return needles.some((n) => h.includes(String(n || "").toLowerCase()));
}

function buildSmartRecommendations(permit, options = {}) {
  const out = [];
  const addRec = (id, text, autofix = null) => {
    if (out.some((row) => row.id === id)) return;
    out.push({ id, text, autofix });
  };
  const type = String(permit?.type || "").toLowerCase();
  const description = cleanText(permit?.description);
  const location = cleanText(permit?.location);
  const notes = cleanText(permit?.notes);
  const evidenceNotes = cleanText(permit?.evidenceNotes);
  const extra = permit?.extraFields || {};
  const dynamic = extra.dynamic || {};
  const linkedRamsId = cleanText(permit?.linkedRamsId);
  const hasEvidencePhoto = Boolean(permit?.evidencePhotoUrl || permit?.evidencePhotoStoragePath);
  const hasChecklistSignal = (text) => {
    const checks = permit?.checklist || {};
    const items = Array.isArray(permit?.checklistItems) ? permit.checklistItems : [];
    const hitItem = items.find((item) => String(item?.text || "").toLowerCase().includes(String(text || "").toLowerCase()));
    if (!hitItem) return false;
    return checks[hitItem.id] === true;
  };

  if (!linkedRamsId) addRec("link_rams", "Link RAMS for stronger legal traceability.");
  if (!hasEvidencePhoto) addRec("evidence_photo", "Attach one site evidence photo before issue.");
  if (!location || location.length < 4) addRec("precise_location", "Refine location to exact zone/area reference.");

  if (type === "hot_work") {
    const fireWatch = cleanText(dynamic.hotWorkFireWatchMins || extra.fireWatcher || extra.postInspectionTime);
    if (!fireWatch && !hasChecklistSignal("fire watch")) {
      addRec(
        "hot_work_fire_watch",
        "Hot work: confirm fire watch details and post-work inspection.",
        { type: "set_dynamic", key: "hotWorkFireWatchMins", value: 60 }
      );
    }
    if (!containsAny(`${description} ${notes} ${evidenceNotes}`, ["extinguisher", "fire blanket"])) {
      addRec(
        "hot_work_fire_controls",
        "Hot work: add extinguisher/fire blanket controls in notes.",
        { type: "append_notes", text: "Fire controls: 2x extinguishers and fire blanket in place." }
      );
    }
  }

  if (type === "electrical" || type === "cold_work" || type === "loto") {
    const lotoEvidence = containsAny(`${description} ${notes} ${evidenceNotes}`, ["loto", "lockout", "isolation", "lock-off"]);
    if (!lotoEvidence) {
      addRec(
        "loto_evidence",
        "Isolation task: capture LOTO/isolation evidence reference.",
        { type: "append_evidence", text: "LOTO evidence: isolation point ID, lock number, try-test completed." }
      );
    }
  }

  if (type === "confined_space") {
    const rescueRef = cleanText(dynamic.csRescuePlanRef || extra.rescuePlanRef || "");
    if (!rescueRef) {
      addRec(
        "confined_space_rescue_ref",
        "Confined space: add rescue plan reference.",
        { type: "set_dynamic", key: "csRescuePlanRef", value: "RESCUE-PLAN-REF" }
      );
    }
    const gasTester = cleanText(dynamic.csGasTester || extra.gasTester || "");
    if (!gasTester) {
      addRec(
        "confined_space_gas_tester",
        "Confined space: record gas tester and latest readings.",
        { type: "set_dynamic", key: "csGasTester", value: "Assigned gas tester" }
      );
    }
  }

  if (type === "excavation" || type === "ground_disturbance") {
    if (!containsAny(`${description} ${notes} ${evidenceNotes}`, ["cat scan", "utility", "service drawing"])) {
      addRec(
        "ground_cat_scan",
        "Ground works: reference CAT scan / utility drawing evidence.",
        { type: "append_evidence", text: "Ground evidence: CAT scan and utility/service drawing checked before disturbance." }
      );
    }
  }

  if (type === "line_break" || containsAny(`${description} ${notes}`, ["chemical", "solvent", "acid"])) {
    if (!containsAny(`${notes} ${evidenceNotes}`, ["sds", "msds"])) {
      addRec("chemical_sds", "Chemical risk: add SDS/MSDS reference.", { type: "append_evidence", text: "SDS/MSDS reference: [insert doc/ref]." });
    }
    if (!containsAny(`${notes} ${evidenceNotes}`, ["ppe"])) {
      addRec("chemical_ppe", "Chemical risk: specify PPE controls.", { type: "append_notes", text: "PPE controls: chemical gloves, eye/face protection, suitable respirator." });
    }
  }

  if (Array.isArray(options?.dynamicMissing) && options.dynamicMissing.length > 0) {
    addRec("dynamic_missing", `Complete dynamic fields: ${options.dynamicMissing.slice(0, 3).join(", ")}`);
  }
  if (Array.isArray(options?.missingRegulatory) && options.missingRegulatory.length > 0) {
    addRec("regulatory_missing", "Resolve critical regulatory evidence gaps before activation.");
  }

  return out.slice(0, 8);
}

export function runPermitQualityGates(permit, options = {}) {
  const required = options?.required || {};
  const hasStart = !!permit?.startDateTime;
  const hasEnd = !!permit?.endDateTime;
  const validRange = hasStart && hasEnd ? new Date(permit.endDateTime) > new Date(permit.startDateTime) : false;
  const checks = [
    {
      id: "description",
      ok: isRequired(required, "description", true) ? !!String(permit?.description || "").trim() : true,
      message: "Description required",
    },
    {
      id: "location",
      ok: isRequired(required, "location", true) ? !!String(permit?.location || "").trim() : true,
      message: "Location required",
    },
    {
      id: "issuedBy",
      ok: isRequired(required, "issuedBy", true) ? !!String(permit?.issuedBy || "").trim() : true,
      message: "Issuer required",
    },
    {
      id: "issuedTo",
      ok: isRequired(required, "issuedTo", true) ? !!String(permit?.issuedTo || "").trim() : true,
      message: "Permit holder required",
    },
    {
      id: "timeRange",
      ok: isRequired(required, "timeRange", true) ? validRange : (!hasStart && !hasEnd ? true : validRange),
      message: "End date/time must be after start date/time",
    },
  ];
  return {
    checks,
    ok: checks.every((c) => c.ok),
    failed: checks.filter((c) => !c.ok),
    recommendations: buildSmartRecommendations(permit, options),
  };
}

