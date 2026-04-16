/**
 * Remove the same Schema.org appendix from DOCS/Blog copies (not bundled; editorial only).
 */
import fs from "fs";
import pathMod from "path";
import { fileURLToPath } from "url";

const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
const root = pathMod.join(__dirname, "..");
const docsBlog = pathMod.join(root, "DOCS", "Blog");
const marker = "\n---\n\n## Schema.org structured data (for CMS / SEO plugin)";

let n = 0;
for (const ent of fs.readdirSync(docsBlog, { withFileTypes: true })) {
  if (!ent.isDirectory() || !ent.name.startsWith("Article")) continue;
  const dir = pathMod.join(docsBlog, ent.name);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const p = pathMod.join(dir, f);
    let full = fs.readFileSync(p, "utf8");
    const idx = full.indexOf(marker);
    if (idx === -1) continue;
    full = full.slice(0, idx).replace(/\s+$/, "\n");
    fs.writeFileSync(p, full);
    n += 1;
  }
}
console.log(`Stripped schema appendix from ${n} DOCS/Blog markdown files`);
