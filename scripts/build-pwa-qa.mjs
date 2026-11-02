import { build, loadEnv } from "vite";

// Isolated production-mode PWA: exercise the real service worker without cloud data.
const env = loadEnv("pwa-qa", process.cwd(), "");
for (const key of new Set([...Object.keys(env), ...Object.keys(process.env)])) {
  if (key.startsWith("VITE_") || key.startsWith("SENTRY_")) process.env[key] = "";
}
await build({ mode: "pwa-qa", build: { outDir: "output/pwa-iphone-build" } });
