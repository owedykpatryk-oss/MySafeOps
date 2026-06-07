/** AI / generic SaaS phrases — flag in blog:voice and verify:blog */
export const BANNED_PHRASES = [
  { pattern: /\bdelve\b/i, label: "delve" },
  { pattern: /\bleverage\b/i, label: "leverage" },
  { pattern: /\bstreamline\b/i, label: "streamline" },
  { pattern: /\brobust\b/i, label: "robust" },
  { pattern: /\bcomprehensive\b/i, label: "comprehensive" },
  { pattern: /\blandscape\b/i, label: "landscape (corporate)" },
  { pattern: /\bnavigate\b/i, label: "navigate (metaphor)" },
  { pattern: /\bgame[- ]?changer\b/i, label: "game-changer" },
  { pattern: /\bcutting[- ]?edge\b/i, label: "cutting-edge" },
  { pattern: /\bseamless(ly)?\b/i, label: "seamless" },
  { pattern: /\bunlock\b/i, label: "unlock" },
  { pattern: /\bempower\b/i, label: "empower" },
  { pattern: /\bdive in(to)?\b/i, label: "dive in" },
  { pattern: /\bharness the\b/i, label: "harness (metaphor)" },
  { pattern: /\bpivotal\b/i, label: "pivotal" },
  { pattern: /\btestament to\b/i, label: "testament to" },
  { pattern: /\bever[- ]evolving\b/i, label: "ever-evolving" },
  { pattern: /\bin today'?s (fast[- ]paced|digital|modern)/i, label: "in today's…" },
  { pattern: /\bin conclusion\b/i, label: "in conclusion" },
  { pattern: /\bit'?s important to note\b/i, label: "it's important to note" },
  { pattern: /\bin this (article|guide|post), we\b/i, label: "in this article we…" },
  { pattern: /\bwhether you'?re a\b/i, label: "whether you're a…" },
  { pattern: /\blook no further\b/i, label: "look no further" },
  { pattern: /\bwhen it comes to\b/i, label: "when it comes to" },
  { pattern: /\bat the end of the day\b/i, label: "at the end of the day" },
  { pattern: /\butili[sz]e\b/i, label: "utilize" },
  { pattern: /\bfurthermore\b/i, label: "furthermore" },
  { pattern: /\bmoreover\b/i, label: "moreover" },
];

/** @param {string} md */
export function checkBlogVoice(md) {
  const text = String(md);
  /** @type {{ label: string; count: number }[]} */
  const hits = [];

  for (const { pattern, label } of BANNED_PHRASES) {
    const m = text.match(new RegExp(pattern.source, "gi"));
    if (m?.length) hits.push({ label, count: m.length });
  }

  const emDash = (text.match(/—/g) || []).length;
  if (emDash > 4) hits.push({ label: `em-dashes (${emDash} — max ~4)`, count: emDash });

  const exclam = (text.match(/!/g) || []).length;
  if (exclam > 2) hits.push({ label: `exclamation marks (${exclam})`, count: exclam });

  const hasScenario =
    /\b(site cabin|site office|07:|7am|rainy|supervisor|foreman|operative|subbie|HSE inspector|principal contractor)\b/i.test(
      text,
    );
  if (!hasScenario && text.length > 2000) {
    hits.push({ label: "no concrete site scenario (add opening scene)", count: 1 });
  }

  const ukLaw =
    /\b(CDM 2015|WAHR|HSG\d+|LOLER|RIDDOR|COSHH|Confined Spaces Regulations|Work at Height Regulations|HSG47)\b/i.test(
      text,
    );
  if (!ukLaw && text.length > 2500) {
    hits.push({ label: "no named UK law/HSE reference", count: 1 });
  }

  return hits;
}
