/**
 * FESS Group — one-click site mobilisation (registers + briefing + contacts).
 */
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { seedFessSiteContacts } from "./fessSiteContacts";
import { seedFessGhpRegister } from "./fessGhpDefaults";
import { seedFessLotoRegister } from "./fessLotoDefaults";
import { seedFessSiteBriefing } from "./fessBriefingRecord";
import { ensureFessSiteProject } from "./fessClientSites";

/**
 * @param {string} siteTemplateId
 */
export function seedFessSiteMobilisation(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "FESS mobilisation is only available for FESS Group workspace." };
  }
  const id = String(siteTemplateId || "").trim();
  if (!id) return { ok: false, message: "Unknown site." };

  const project = ensureFessSiteProject(id);
  if (!project) return { ok: false, message: "Could not resolve site project." };

  const ghp = seedFessGhpRegister(id);
  const loto = seedFessLotoRegister(id);
  const contacts = seedFessSiteContacts();
  const briefing = seedFessSiteBriefing(id);

  const parts = [];
  if (ghp.created) parts.push(`${ghp.created} G&HP`);
  if (loto.created) parts.push(`${loto.created} LOTO`);
  if (contacts.created) parts.push(`${contacts.created} contact(s)`);
  if (briefing.created) parts.push("today's briefing");

  return {
    ok: true,
    project,
    ghp,
    loto,
    contacts,
    briefing,
    message: parts.length
      ? `Mobilised ${project.name}: ${parts.join(", ")}.`
      : `Mobilisation registers already ready for ${project.name}.`,
  };
}
