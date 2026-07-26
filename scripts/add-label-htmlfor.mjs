/**
 * One-shot codemod: pair <label style={ss.lbl}> with adjacent input/select/textarea
 * via htmlFor + id in src/modules form editors.
 *
 * Run: node scripts/add-label-htmlfor.mjs
 * Dry-run: node scripts/add-label-htmlfor.mjs --dry
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.join(__dirname, "../src/modules");
const dry = process.argv.includes("--dry");

/** @param {string} filename */
function modulePrefix(filename) {
  const base = filename.replace(/\.jsx?$/, "");
  return base
    .replace(/Register$/, "")
    .replace(/Log$/, "")
    .replace(/Matrix$/, "")
    .replace(/Tracker$/, "")
    .replace(/Wizard$/, "")
    .replace(/System$/, "")
    .replace(/Panel$/, "")
    .replace(/Editor$/, "")
    .replace(/Builder$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/^-|-$/g, "") || "field";
}

/** @param {string} text */
function slugify(text) {
  return String(text)
    .replace(/\s*\*\s*$/, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "field";
}

/**
 * Find matching closing tag index for an opening tag starting at openAngle.
 * Handles nested same-tag children.
 * @param {string} src
 * @param {number} openAngle
 * @param {string} tag
 */
function findClosingTag(src, openAngle, tag) {
  const openRe = new RegExp(`<${tag}\\b`, "g");
  const closeRe = new RegExp(`</${tag}>`, "g");
  const selfCloseCheck = src.slice(openAngle, openAngle + 4000);
  const firstGt = selfCloseCheck.indexOf(">");
  if (firstGt === -1) return -1;
  const openTag = selfCloseCheck.slice(0, firstGt + 1);
  if (/\/>\s*$/.test(openTag) || openTag.endsWith("/>")) {
    return openAngle + firstGt + 1;
  }

  let depth = 0;
  let i = openAngle;
  while (i < src.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(src);
    const c = closeRe.exec(src);
    if (!c) return -1;
    if (o && o.index < c.index) {
      const slice = src.slice(o.index, o.index + 500);
      const gt = slice.indexOf(">");
      const tagText = gt >= 0 ? slice.slice(0, gt + 1) : slice;
      if (!/\/>\s*$/.test(tagText) && !tagText.includes("/>")) {
        depth++;
      }
      i = o.index + (gt >= 0 ? gt + 1 : o[0].length);
      continue;
    }
    depth--;
    i = c.index + c[0].length;
    if (depth === 0) return i;
  }
  return -1;
}

/**
 * @param {string} openTag
 * @param {string} attr
 * @param {string} valueExpr  quoted string or JSX expression without braces wrapper for template
 * @param {boolean} isExpr
 */
function injectAttr(openTag, attr, value, isExpr) {
  if (new RegExp(`\\b${attr}\\s*=`).test(openTag)) return openTag;
  const insertion = isExpr ? ` ${attr}={${value}}` : ` ${attr}="${value}"`;
  if (openTag.endsWith("/>")) {
    return openTag.slice(0, -2) + insertion + " />";
  }
  if (openTag.endsWith(">")) {
    return openTag.slice(0, -1) + insertion + ">";
  }
  return openTag + insertion;
}

/**
 * Walk backwards from label to detect .map((ident) context.
 * Skips option/pill maps that sit between the row map and the label.
 * @param {string} src
 * @param {number} pos
 * @param {string|null} preferredIdent  if control binds value={ident.x}, prefer that
 */
function detectMapIdent(src, pos, preferredIdent = null) {
  const before = src.slice(Math.max(0, pos - 4000), pos);
  const matches = [...before.matchAll(/\.map\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)/g)];
  if (!matches.length) return null;

  if (preferredIdent) {
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i][1] === preferredIdent) return preferredIdent;
    }
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const after = before.slice(m.index + m[0].length, m.index + m[0].length + 120);
    // Skip inline option maps: .map(x => <option ...>)
    if (/^\s*\)?\s*=>\s*\(?\s*<option\b/.test(after)) continue;
    if (/^\s*,\s*[A-Za-z_$][\w$]*\s*\)\s*=>\s*\(?\s*<option\b/.test(after)) continue;
    return m[1];
  }
  return matches[matches.length - 1][1];
}

/**
 * @param {string} controlOpen
 * @param {string} src
 * @param {number} labelStart
 * @param {string} labelText
 * @param {string} prefix
 * @param {Set<string>} usedIds
 */
function deriveId(controlOpen, src, labelStart, labelText, prefix, usedIds) {
  let field = null;
  let mapIdent = null;
  let dynamic = false;

  const setMatch = controlOpen.match(/\bset\(\s*["']([A-Za-z_][\w]*)["']/);
  if (setMatch) field = setMatch[1];

  if (!field) {
    const formMatch = controlOpen.match(/\b(?:value|defaultValue)\s*=\s*\{\s*form\.([A-Za-z_][\w]*)/);
    if (formMatch) field = formMatch[1];
  }

  // value={item.field} or value={item.field ? ...} — treat non-form objects as map-row fields
  if (!field) {
    const anyObj = controlOpen.match(
      /\b(?:value|defaultValue)\s*=\s*\{\s*([A-Za-z_$][\w$]*)\.([A-Za-z_][\w]*)/
    );
    if (anyObj && !["form", "e", "event", "ss", "styles"].includes(anyObj[1])) {
      const ident = anyObj[1];
      const detected = detectMapIdent(src, labelStart, ident);
      if (detected === ident || detectMapIdent(src, labelStart) === ident) {
        field = anyObj[2];
        mapIdent = ident;
        dynamic = true;
      } else if (!field) {
        field = anyObj[2];
        // Still dynamic if control clearly uses ident.id in onChange nearby
        if (new RegExp(`\\b${ident}\\.id\\b`).test(controlOpen)) {
          mapIdent = ident;
          dynamic = true;
        }
      }
    }
  }

  if (!field && !dynamic) {
    mapIdent = detectMapIdent(src, labelStart);
  }

  const slug = field ? field.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() : slugify(labelText);
  const base = `${prefix}-${slug}`;

  if (dynamic && mapIdent) {
    const expr = `\`${base}-\${${mapIdent}.id}\``;
    return { idValue: expr, isExpr: true, key: `${base}-dynamic` };
  }

  let id = base;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${base}-${n++}`;
  }
  usedIds.add(id);
  return { idValue: id, isExpr: false, key: id };
}

/**
 * @param {string} src
 * @param {string} filename
 */
function patchSource(src, filename) {
  const prefix = modulePrefix(filename);
  const usedIds = new Set();
  // Collect existing ids to avoid collisions
  for (const m of src.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) usedIds.add(m[1]);
  for (const m of src.matchAll(/\bhtmlFor\s*=\s*["']([^"']+)["']/g)) usedIds.add(m[1]);

  let out = "";
  let i = 0;
  let paired = 0;
  let skipped = 0;

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
    const labelOpen = src.slice(labelStart, labelOpenEnd + 1);

    // Self-closing or malformed — copy through
    if (labelOpen.endsWith("/>")) {
      out += labelOpen;
      i = labelOpenEnd + 1;
      continue;
    }

    const labelClose = src.indexOf("</label>", labelOpenEnd + 1);
    if (labelClose === -1) {
      out += src.slice(labelStart);
      break;
    }
    const labelInner = src.slice(labelOpenEnd + 1, labelClose);
    const fullLabelEnd = labelClose + "</label>".length;

    const isSsLbl = /ss\.lbl/.test(labelOpen) || /ss\.lbl/.test(labelInner);
    const hasHtmlFor = /\bhtmlFor\s*=/.test(labelOpen);
    const wrapsControl = /<(input|select|textarea)\b/.test(labelInner);
    const labelText = labelInner.replace(/<[^>]+>/g, "").trim();

    if (!isSsLbl || hasHtmlFor || wrapsControl || !labelText) {
      out += src.slice(labelStart, fullLabelEnd);
      i = fullLabelEnd;
      if (isSsLbl && (hasHtmlFor || wrapsControl)) skipped++;
      continue;
    }

    // Find next non-whitespace sibling
    let j = fullLabelEnd;
    while (j < src.length && /\s/.test(src[j])) j++;

    const next = src.slice(j, j + 20);
    const controlMatch = next.match(/^<(input|select|textarea)\b/);
    if (!controlMatch) {
      out += src.slice(labelStart, fullLabelEnd);
      i = fullLabelEnd;
      skipped++;
      continue;
    }

    const tag = controlMatch[1];
    const controlOpenEndRel = (() => {
      // Find end of opening tag, respecting strings
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
          // skip JSX expression roughly by brace depth
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
        if (ch === ">") return k;
        k++;
      }
      return -1;
    })();

    if (controlOpenEndRel === -1) {
      out += src.slice(labelStart, fullLabelEnd);
      i = fullLabelEnd;
      skipped++;
      continue;
    }

    const controlOpen = src.slice(j, controlOpenEndRel + 1);
    if (/\bid\s*=/.test(controlOpen)) {
      // Control already has id — still wire htmlFor if we can reuse it
      const idLit = controlOpen.match(/\bid\s*=\s*["']([^"']+)["']/);
      const idExpr = controlOpen.match(/\bid\s*=\s*\{([^}]+)\}/);
      let newLabelOpen;
      if (idLit) {
        newLabelOpen = injectAttr(labelOpen, "htmlFor", idLit[1], false);
      } else if (idExpr) {
        newLabelOpen = injectAttr(labelOpen, "htmlFor", idExpr[1].trim(), true);
      } else {
        out += src.slice(labelStart, fullLabelEnd);
        i = fullLabelEnd;
        skipped++;
        continue;
      }
      out += newLabelOpen + labelInner + "</label>";
      out += src.slice(fullLabelEnd, j);
      out += controlOpen;
      i = controlOpenEndRel + 1;
      paired++;
      continue;
    }

    const { idValue, isExpr } = deriveId(controlOpen, src, labelStart, labelText, prefix, usedIds);

    const fixedLabelOpen = injectAttr(labelOpen, "htmlFor", idValue, isExpr);
    const newControlOpen = injectAttr(controlOpen, "id", idValue, isExpr);

    out += fixedLabelOpen + labelInner + "</label>";
    out += src.slice(fullLabelEnd, j);
    out += newControlOpen;
    i = controlOpenEndRel + 1;
    paired++;
  }

  return { src: out, paired, skipped };
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.jsx?$/.test(ent.name)) files.push(p);
  }
  return files;
}

const files = walk(modulesDir).filter((f) => {
  const src = fs.readFileSync(f, "utf8");
  return src.includes("ss.lbl") && src.includes("<label");
});

let totalPaired = 0;
let totalSkipped = 0;
let filesChanged = 0;

for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const { src, paired, skipped } = patchSource(before, path.basename(file));
  totalPaired += paired;
  totalSkipped += skipped;
  if (src !== before) {
    filesChanged++;
    if (!dry) fs.writeFileSync(file, src, "utf8");
    console.log(`${dry ? "[dry] " : ""}${path.relative(modulesDir, file)}: +${paired} pairs (skipped ${skipped})`);
  } else if (paired || skipped) {
    console.log(`${path.relative(modulesDir, file)}: no change (paired ${paired}, skipped ${skipped})`);
  }
}

console.log(`\nDone. files=${filesChanged} paired=${totalPaired} skipped=${totalSkipped} dry=${dry}`);
