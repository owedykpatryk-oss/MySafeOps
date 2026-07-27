/**
 * Guard: hooks under src/hooks must stay .js without JSX (Vite fails the whole app otherwise).
 * Recurses nested folders (e.g. src/hooks/blog/).
 * Run: node scripts/check-hooks-no-jsx.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const hooksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "hooks");
const JSX_HINT =
  /(?:return\s*\(|=>\s*\()\s*<[A-Za-z]|<[A-Za-z][A-Za-z0-9]*(\s|>|\/)|<\/[A-Za-z]|<>|<\/>/;

/** @param {string} dir */
function walkJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...walkJsFiles(path));
      continue;
    }
    if (name.endsWith(".js") && !name.endsWith(".test.js")) out.push(path);
  }
  return out;
}

let failed = 0;
for (const path of walkJsFiles(hooksDir)) {
  const src = readFileSync(path, "utf8");
  if (JSX_HINT.test(src)) {
    console.error(`FAIL: JSX in ${path} — move components to .jsx (Vite cannot parse JSX in .js).`);
    failed += 1;
  }
}

if (failed) {
  process.exit(1);
}
console.log("check-hooks-no-jsx OK");
