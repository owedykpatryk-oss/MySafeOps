/**
 * FESS MS workflow helpers — parse RAMS method text into MS steps.
 */

/**
 * @param {string} methodText
 * @returns {string[]}
 */
export function parseRamsMethodSteps(methodText) {
  const raw = String(methodText || "").trim();
  if (!raw) return [];
  const numbered = raw.split(/\n\s*\n+/).map((chunk) => chunk.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered;
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^\d+[\).\s]+/, "").trim())
    .filter(Boolean);
}

/**
 * @param {object} ramsDoc
 * @param {string} genId
 */
export function buildMsStepsFromRams(ramsDoc, genId) {
  const chunks = parseRamsMethodSteps(ramsDoc?.surveyMethodStatement || "");
  return chunks.map((desc, i) => ({
    id: genId(),
    seq: i + 1,
    title: `${desc.split(" ").slice(0, 5).join(" ")}…`,
    description: desc,
    responsible: "",
    duration: "",
  }));
}
