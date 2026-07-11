/**
 * FESS Group project playbooks — derived from MC reference RAMS (org-exclusive).
 */
import { FESS_JOB_STARTERS } from "./fessJobStarters";
import { canUseFessExclusiveFeatures } from "./fessExclusive";

/** @type {Array<{ id: string, label: string, description: string, industryStarter?: string, fessJobStarterKey: string, permitTypes: string[], msTemplate?: string, orgExclusive: boolean, checklistExtras: string[] }>} */
export const FESS_PROJECT_PLAYBOOKS = FESS_JOB_STARTERS.map((starter) => ({
  id: `fess_${starter.key}`,
  label: starter.label,
  description: `${starter.client} — ${starter.siteHint}. RAMS with standard site RA baseline, permits and food factory method statement.`,
  industryStarter: "general",
  fessJobStarterKey: starter.key,
  permitTypes: [...starter.permitTypes],
  msTemplate: starter.msTemplate || "foodFactoryMobilisation",
  orgExclusive: true,
  checklistExtras: [
    `Confirm line clearance / production isolation for ${starter.siteHint}`,
    "Brief operatives on hygiene, foreign-body and G&HP controls",
    "Verify LOTO and permit controller sign-off before intrusive work",
    "Capture test/validation evidence before production handback",
  ],
}));

/** @param {string} playbookId */
export function getFessPlaybook(playbookId) {
  if (!canUseFessExclusiveFeatures()) return null;
  return FESS_PROJECT_PLAYBOOKS.find((p) => p.id === playbookId) || null;
}
