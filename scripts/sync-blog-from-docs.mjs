/**
 * Regenerate `src/blog/posts/{slug}.md` from canonical drafts under `DOCS/Blog/`.
 * Strips the Schema.org appendix (not shown on site), inserts hero image before TOC,
 * normalises the footer link block to **See also:** for the live blog.
 *
 * Run: node scripts/sync-blog-from-docs.mjs
 * Then: npm run verify:blog
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} raw
 * @param {{ alt: string; heroUrl: string }} hero
 * @param {string} seeAlsoLine markdown line without trailing newline (starts with **See also:**)
 * @param {{ stripFessCaseStudy?: boolean }} opts
 */
function transform(raw, hero, seeAlsoLine, opts = {}) {
  let t = raw.split(/\r?\n## Schema\.org structured data/)[0].trimEnd();
  t = t.replace(/\r\n/g, "\n");

  const h1 = t.indexOf("# ");
  if (h1 === -1) throw new Error("No H1");
  const anchor = "\n\n---\n\n**Table of contents**";
  const j = t.indexOf(anchor, h1);
  if (j === -1) throw new Error("No TOC anchor");
  const insert = `\n\n![${hero.alt}](${hero.heroUrl})`;
  t = t.slice(0, j) + insert + t.slice(j);

  t = t.replace(
    /\*\*(?:Internal link suggestions:|See also \(when syncing to app\):)\*\*[\s\S]*?(?=\*\*Disclaimer:\*\*)/,
    `${seeAlsoLine}\n\n`,
  );

  if (opts.stripFessCaseStudy) {
    t = t.replace(
      /For a firm handling 2-4 emergency callouts per month \(as FESS Group does on UK food industry sites\),/g,
      "For a firm handling 2-4 emergency callouts per month (a pattern common on busy UK food-industry maintenance sites),",
    );
    t = t.replace(
      "### Scenario 2: 20-person UK contractor (like FESS Group)",
      "### Scenario 2: 20-person UK contractor",
    );
    t = t.replace(
      /Documented at \[FESS Group in their case study\]\(https:\/\/mysafeops\.com\/blog\/fess-case-study\) as the trigger for digital transition\./,
      "That pattern is a common trigger for moving to a digital RAMS workflow with timestamped, point-of-work sign-off.",
    );
    t = t.replace(
      /See the \[FESS Group case study\]\(https:\/\/mysafeops\.com\/blog\/fess-case-study\) for a real example\./,
      "Principal contractors and insurers increasingly expect version control and sign-off evidence, which is harder to demonstrate with ad-hoc paper bundles.",
    );
    t = t.replace(
      /- FESS Group case study \(MySafeOps internal\): https:\/\/mysafeops\.com\/blog\/fess-case-study\n?/,
      "",
    );
  }

  return `${t.trimEnd()}\n`;
}

const posts = [
  {
    src: "DOCS/Blog/Article 11/11-how-to-write-a-rams-uk.md",
    out: "src/blog/posts/how-to-write-a-rams-uk.md",
    hero: {
      alt: "UK construction site office desk with RAMS and safety paperwork",
      heroUrl: "https://mysafeops.com/blog/images/how-to-write-a-rams-uk-hero.png",
    },
    seeAlso:
      "**See also:** [Permit to work app UK](https://mysafeops.com/blog/permit-to-work-app-uk) · [COSHH register software UK](https://mysafeops.com/blog/coshh-register-software-uk) · [RIDDOR changes 2026](https://mysafeops.com/blog/riddor-changes-2026) · [Hot work permit UK](https://mysafeops.com/blog/hot-work-permit-uk) · [Free safety app for construction workers](https://mysafeops.com/blog/free-safety-app-construction-workers)",
    opts: {},
  },
  {
    src: "DOCS/Blog/Article 12/13-cdm-2015-small-contractor-uk.md",
    out: "src/blog/posts/cdm-2015-small-contractor-uk.md",
    hero: {
      alt: "Small UK building site — contractor planning and CDM paperwork",
      heroUrl: "https://mysafeops.com/blog/images/cdm-2015-small-contractor-uk-hero.png",
    },
    seeAlso:
      "**See also:** [How to write a RAMS UK](https://mysafeops.com/blog/how-to-write-a-rams-uk) · [Permit to work app UK](https://mysafeops.com/blog/permit-to-work-app-uk) · [COSHH register software UK](https://mysafeops.com/blog/coshh-register-software-uk) · [Site induction software UK](https://mysafeops.com/blog/site-induction-software-uk)",
    opts: {},
  },
  {
    src: "DOCS/Blog/Article 13/14-scaffold-inspection-checklist-uk.md",
    out: "src/blog/posts/scaffold-inspection-checklist-uk.md",
    hero: {
      alt: "UK construction scaffolding — inspection and access",
      heroUrl: "https://mysafeops.com/blog/images/scaffold-inspection-checklist-uk-hero.png",
    },
    seeAlso:
      "**See also:** [Permit to work app UK](https://mysafeops.com/blog/permit-to-work-app-uk) · [How to write a RAMS UK](https://mysafeops.com/blog/how-to-write-a-rams-uk) · [RIDDOR changes 2026](https://mysafeops.com/blog/riddor-changes-2026) · [Free safety app for construction workers](https://mysafeops.com/blog/free-safety-app-construction-workers)",
    opts: {},
  },
  {
    src: "DOCS/Blog/Article 14/15-paper-vs-digital-rams-uk.md",
    out: "src/blog/posts/paper-vs-digital-rams-uk.md",
    hero: {
      alt: "UK construction — paper RAMS paperwork versus digital on tablet",
      heroUrl: "https://mysafeops.com/blog/images/paper-vs-digital-rams-uk-hero.png",
    },
    seeAlso:
      "**See also:** [How to write a RAMS UK](https://mysafeops.com/blog/how-to-write-a-rams-uk) · [Best permit to work software UK 2026](https://mysafeops.com/blog/best-permit-to-work-software-uk-2026) · [Free safety app for construction workers](https://mysafeops.com/blog/free-safety-app-construction-workers) · [Digital toolbox talks](https://mysafeops.com/blog/digital-toolbox-talks)",
    opts: { stripFessCaseStudy: true },
  },
];

for (const p of posts) {
  const raw = fs.readFileSync(path.join(root, p.src), "utf8");
  const out = transform(raw, p.hero, p.seeAlso, p.opts);
  fs.writeFileSync(path.join(root, p.out), out, "utf8");
  console.log("Wrote", p.out);
}
