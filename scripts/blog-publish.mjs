/**
 * Post-publish: verify, regenerate SEO feeds, optional distribution pack.
 *
 * Usage:
 *   npm run blog:publish                    # all feeds
 *   npm run blog:publish -- height-work-permit-uk   # + distribution pack
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const slug = process.argv[2]?.startsWith("--slug=")
  ? process.argv[2].slice("--slug=".length)
  : process.argv[2];

function run(label, cmd, args) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("verify:blog", "npm", ["run", "verify:blog"]);
if (slug) {
  run(`voice lint (${slug})`, "node", ["scripts/blog-voice-check.mjs", slug]);
} else {
  run("voice lint (all)", "node", ["scripts/blog-voice-check.mjs"]);
}
run("sitemap", "node", ["scripts/generate-sitemap.mjs"]);
run("image sitemap", "node", ["scripts/generate-image-sitemap.mjs"]);
run("RSS", "node", ["scripts/generate-blog-rss.mjs"]);

if (slug) {
  run(`distribution pack (${slug})`, "node", ["scripts/generate-distribution-pack.mjs", slug]);
  run("image prompt", "node", ["scripts/generate-image-prompt.mjs", slug]);
}

console.log("\n✓ blog:publish complete");
