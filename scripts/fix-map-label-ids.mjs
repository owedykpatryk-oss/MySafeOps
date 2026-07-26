/**
 * Fixup: convert static htmlFor/id pairs on mapped-row controls to unique template ids.
 * Run after add-label-htmlfor.mjs when nested .map (e.g. options) confused detectMapIdent.
 *
 * node scripts/fix-map-label-ids.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.join(__dirname, "../src/modules");

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.jsx?$/.test(ent.name)) files.push(p);
  }
  return files;
}

function fixFile(src) {
  let fixed = 0;
  // Match label htmlFor="static" ... control value={ident.field...} ... id="same-static"
  // Non-greedy across a short window.
  const re =
    /(<label\b[^>]*\bhtmlFor=")([a-z0-9-]+)("[\s\S]{0,400}?<(?:input|select|textarea)\b[^>]*?\bvalue=\{\s*)([A-Za-z_$][\w$]*)(\.[A-Za-z_][\w$]*[\s\S]{0,500}?\bid=")(\2)(")/g;

  const out = src.replace(re, (match, a, staticId, mid, ident, mid2, _id, end) => {
    if (ident === "form") return match;
    // Only upgrade if this ident is used in a .map nearby (heuristic: .map((ident or .map(ident)
    const idx = src.indexOf(match);
    const before = src.slice(Math.max(0, idx - 3000), idx);
    const mapRe = new RegExp(`\\.map\\s*\\(\\s*\\(?\\s*${ident}\\b`);
    if (!mapRe.test(before)) return match;
    fixed++;
    const expr = `{\`${staticId}-\${${ident}.id}\`}`;
    return `${a.slice(0, -1)}={${expr.slice(1)}` + mid + ident + mid2 + expr.slice(1, -1) + `{` + end.replace(/^"/, "");
  });

  // The replace above is getting messy. Do a clearer two-pass approach instead.
  return { src: null, fixed: 0, useAlt: true };
}

function fixFileAlt(src) {
  let fixed = 0;
  let out = "";
  let i = 0;

  while (i < src.length) {
    const labelStart = src.indexOf("<label", i);
    if (labelStart === -1) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, labelStart);

    const labelOpenEnd = src.indexOf(">", labelStart);
    if (labelOpenEnd === -1) {
      out += src.slice(labelStart);
      break;
    }
    let labelOpen = src.slice(labelStart, labelOpenEnd + 1);
    const labelClose = src.indexOf("</label>", labelOpenEnd + 1);
    if (labelClose === -1) {
      out += src.slice(labelStart);
      break;
    }
    const labelInner = src.slice(labelOpenEnd + 1, labelClose);
    const fullLabelEnd = labelClose + "</label>".length;

    const htmlForLit = labelOpen.match(/\bhtmlFor="([a-z0-9-]+)"/);
    if (!htmlForLit) {
      out += src.slice(labelStart, fullLabelEnd);
      i = fullLabelEnd;
      continue;
    }

    let j = fullLabelEnd;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (!/^<(input|select|textarea)\b/.test(src.slice(j, j + 20))) {
      out += src.slice(labelStart, fullLabelEnd);
      i = fullLabelEnd;
      continue;
    }

    // Parse control open tag
    let k = j + 1;
    let inStr = null;
    while (k < src.length) {
      const ch = src[k];
      if (inStr) {
        if (ch === "\\" && inStr !== "`") {
          k += 2;
          continue;
        }
        if (ch === inStr) inStr = null;
        k++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
        k++;
        continue;
      }
      if (ch === "{") {
        let depth = 1;
        k++;
        while (k < src.length && depth > 0) {
          if (src[k] === "{") depth++;
          else if (src[k] === "}") depth--;
          else if (src[k] === '"' || src[k] === "'" || src[k] === "`") {
            const q = src[k++];
            while (k < src.length && src[k] !== q) {
              if (src[k] === "\\" && q !== "`") k++;
              k++;
            }
          }
          k++;
        }
        continue;
      }
      if (ch === ">") break;
      k++;
    }
    let controlOpen = src.slice(j, k + 1);
    const staticId = htmlForLit[1];
    const idLit = controlOpen.match(new RegExp(`\\bid="${staticId}"`));
    if (!idLit) {
      out += src.slice(labelStart, fullLabelEnd);
      out += src.slice(fullLabelEnd, k + 1);
      i = k + 1;
      continue;
    }

    const valObj = controlOpen.match(/\b(?:value|defaultValue)\s*=\s*\{\s*([A-Za-z_$][\w$]*)\./);
    if (!valObj || valObj[1] === "form") {
      out += src.slice(labelStart, fullLabelEnd);
      out += src.slice(fullLabelEnd, k + 1);
      i = k + 1;
      continue;
    }
    const ident = valObj[1];
    const before = src.slice(Math.max(0, labelStart - 4000), labelStart);
    if (!new RegExp(`\\.map\\s*\\(\\s*\\(?\\s*${ident}\\b`).test(before)) {
      out += src.slice(labelStart, fullLabelEnd);
      out += src.slice(fullLabelEnd, k + 1);
      i = k + 1;
      continue;
    }

    const expr = `\`${staticId}-\${${ident}.id}\``;
    labelOpen = labelOpen.replace(`htmlFor="${staticId}"`, `htmlFor={${expr}}`);
    controlOpen = controlOpen.replace(`id="${staticId}"`, `id={${expr}}`);
    out += labelOpen + labelInner + "</label>";
    out += src.slice(fullLabelEnd, j);
    out += controlOpen;
    i = k + 1;
    fixed++;
  }

  return { src: out, fixed };
}

let total = 0;
for (const file of walk(modulesDir)) {
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes("htmlFor=") || !before.includes(".map(")) continue;
  const { src, fixed } = fixFileAlt(before);
  if (fixed > 0) {
    fs.writeFileSync(file, src, "utf8");
    console.log(`${path.relative(modulesDir, file)}: fixed ${fixed} map-row ids`);
    total += fixed;
  }
}
console.log(`\nTotal fixed: ${total}`);
