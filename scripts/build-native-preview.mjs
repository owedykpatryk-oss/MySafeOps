import { build, loadEnv } from "vite";

// A reproducible device-only preview, never an accidental production release.
// Vite also loads .env files: override every public key before loading its config.
const env = loadEnv("native", process.cwd(), "");
for (const key of new Set([...Object.keys(env), ...Object.keys(process.env)])) {
  if (key.startsWith("VITE_") || key.startsWith("SENTRY_")) process.env[key] = "";
}
process.env.VITE_NATIVE_PREVIEW = "true";
process.env.VITE_API_BASE_URL = "https://native-preview.invalid";
process.env.VITE_PUBLIC_SITE_URL = "https://native-preview.invalid";

await build({ mode: "native", build: { outDir: "dist-native" } });
console.log("Native PREVIEW built: device-only data, no cloud login/sync. Not a store release.");
