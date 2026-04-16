import fs from "fs";

const html = fs.readFileSync("c:/Users/user/Desktop/index.html", "utf8");
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) throw new Error("no style block");
let css = m[1].trim();

// Scope to .landing-page (SPA-safe: no bare body/html/* that leaks globally)
css = css.replace(/^\*\{[^}]*\}/, ".landing-page, .landing-page *{margin:0;padding:0;box-sizing:border-box}");
css = css.replace(/:root\s*\{/, ".landing-page{");
css = css.replace(/\bhtml\s*\{[^}]*\}/, "");
css = css.replace(/\bbody\s*\{/, ".landing-page{");
css = css.replace(/\bnav\s*\{/g, ".landing-page nav.landing-top-nav{");
css = css.replace(/\bfooter\s*\{/g, ".landing-page footer{");

fs.mkdirSync("src/styles", { recursive: true });
fs.writeFileSync(
  "src/styles/landing.css",
  `/* Landing page — scoped under .landing-page (from Desktop index.html) */\n${css}\n`
);
console.log("Wrote src/styles/landing.css");
