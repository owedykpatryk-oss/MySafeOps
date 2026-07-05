/**
 * Solo workspace helpers — one person can run PM, HSE, permits and site records.
 */

export function deriveUserDisplayName(user, orgSettings = {}) {
  const meta = user?.user_metadata || {};
  const fromMeta = meta.full_name || meta.name;
  if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim();
  if (orgSettings?.defaultLeadEngineer?.trim()) return orgSettings.defaultLeadEngineer.trim();
  const email = String(user?.email || orgSettings?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0].replace(/[._+-]+/g, " ").trim() || "Site lead";
  return "Site lead";
}

/** @param {unknown[]} workers */
export function isSoloWorkspace(workers = []) {
  return !Array.isArray(workers) || workers.length <= 1;
}

export function inferSoloMode(project, workers = []) {
  if (project?.soloMode === true) return true;
  if (project?.soloMode === false) return false;
  return isSoloWorkspace(workers);
}

export function applySoloProjectRoles(form, displayName) {
  const name = String(displayName || form?.soloLeadName || "").trim() || "Site lead";
  return {
    ...form,
    soloMode: true,
    soloLeadName: name,
    owner: String(form?.owner || "").trim() || name,
    hseLead: String(form?.hseLead || "").trim() || name,
    siteManager: String(form?.siteManager || "").trim() || name,
  };
}

function hasCoords(form) {
  return form?.lat != null && form?.lat !== "" && form?.lng != null && form?.lng !== "";
}

/**
 * @param {Record<string, unknown>} form
 * @param {{ soloMode?: boolean }} [opts]
 */
export function projectMissingItems(form, opts = {}) {
  const soloMode = opts.soloMode ?? inferSoloMode(form);
  const missing = [];
  if (!String(form?.name || "").trim()) missing.push("Project name");
  if (!String(form?.site || "").trim()) missing.push("Site / client");
  if (!String(form?.address || "").trim()) missing.push("Address");
  if (soloMode) {
    const lead = String(form?.soloLeadName || form?.owner || "").trim();
    if (!lead) missing.push("Your name / role");
  } else {
    if (!String(form?.owner || "").trim()) missing.push("Project owner");
    if (!String(form?.hseLead || "").trim()) missing.push("HSE lead");
  }
  if (!String(form?.timelineStart || "").trim()) missing.push("Start date");
  if (!String(form?.timelineEnd || "").trim()) missing.push("Target end date");
  if (!soloMode && !hasCoords(form)) missing.push("Coordinates");
  return missing;
}

/**
 * @param {Record<string, unknown>} form
 * @param {{ soloMode?: boolean }} [opts]
 */
export function projectHealthScore(form, opts = {}) {
  const soloMode = opts.soloMode ?? inferSoloMode(form);
  const checks = [
    Boolean(String(form?.name || "").trim()),
    Boolean(String(form?.site || "").trim()),
    Boolean(String(form?.address || "").trim()),
    soloMode
      ? Boolean(String(form?.soloLeadName || form?.owner || "").trim())
      : Boolean(String(form?.owner || "").trim()),
    soloMode ? true : Boolean(String(form?.hseLead || "").trim()),
    Boolean(String(form?.timelineStart || "").trim()),
    Boolean(String(form?.timelineEnd || "").trim()),
    soloMode ? true : hasCoords(form),
    Array.isArray(form?.riskRegister) && form.riskRegister.length > 0,
    Boolean(String(form?.industryStarter || "").trim()),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function adaptPresetChecklistItem(text, soloMode) {
  const t = String(text || "");
  if (!soloMode) return t;
  if (/assign hse lead/i.test(t)) return "Set emergency contacts and nearest A&E on the project";
  if (/invite|teammate|team member/i.test(t)) return "Optional: invite a teammate when the crew grows";
  return t;
}

/**
 * @param {Record<string, unknown>} form
 * @param {{ soloMode?: boolean, preset?: { starterChecklist?: string[] } }} [opts]
 */
export function buildStartupChecklist(form, opts = {}) {
  const soloMode = opts.soloMode ?? inferSoloMode(form);
  const preset = opts.preset || {};
  const base = soloMode
    ? [
        "Confirm you are owner, HSE lead and permit approver for this site",
        "Review permit default flow for this project",
        "Run pre-start safety briefing (yourself counts)",
      ]
    : [
        "Invite site team and assign responsibilities",
        "Review permit default flow for this project",
        "Run pre-start safety briefing",
      ];
  const presetItems = (preset.starterChecklist || []).map((item) => adaptPresetChecklistItem(item, soloMode));
  const missing = projectMissingItems(form, { soloMode }).map((m) => `Fill missing: ${m}`);
  return Array.from(new Set([...base, ...presetItems, ...missing])).slice(0, 16).map((text, idx) => ({
    id: `pc_${Date.now().toString(36)}_${idx}`,
    text,
    status: "todo",
  }));
}

/** @returns {Record<string, unknown> | null} */
export function buildSoloWorkerSeed(user, orgSettings = {}, genId = () => `w_${Date.now()}`) {
  const name = deriveUserDisplayName(user, orgSettings);
  const email = String(user?.email || orgSettings?.email || "").trim();
  return {
    id: genId(),
    name,
    role: "Owner / HSE / Site",
    email,
    phone: orgSettings?.phone || "",
    certs: "",
    createdAt: new Date().toISOString(),
    soloSeed: true,
  };
}
