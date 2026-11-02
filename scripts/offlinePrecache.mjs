import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const VERSION_PATTERN = /const SW_VERSION = "[^"]+";/;
const ASSETS_MARKER = "const BUILD_ASSETS = /* BUILD_ASSETS */ [];";

export function renderOfflineWorker(source, assetPaths, version) {
  if (!VERSION_PATTERN.test(source) || !source.includes(ASSETS_MARKER)) {
    throw new Error("Offline worker build markers are missing");
  }
  const paths = [...new Set(assetPaths)].sort();
  if (paths.some((asset) => !/^\/assets\/[A-Za-z0-9_./-]+$/.test(asset))) {
    throw new Error("Invalid offline precache asset path");
  }
  return source
    .replace(VERSION_PATTERN, `const SW_VERSION = "mysafeops-${version}";`)
    .replace(ASSETS_MARKER, `const BUILD_ASSETS = /* BUILD_ASSETS */ ${JSON.stringify(paths)};`);
}

export function offlinePrecachePlugin() {
  return {
    name: "offline-precache",
    apply: "build",
    async writeBundle(outputOptions, bundle) {
      const outputDir = outputOptions.dir || path.dirname(outputOptions.file);
      const workerPath = path.join(outputDir, "service-worker.js");
      const source = await readFile(workerPath, "utf8");
      const assetPaths = Object.keys(bundle)
        .filter((name) => name.startsWith("assets/") && !name.endsWith(".map"))
        .map((name) => `/${name}`);
      const hash = createHash("sha256");
      hash.update(source);
      const shellFiles = [
        "index.html", "offline.html", "manifest.webmanifest", "vite.svg",
        "branding/fess-group-logo.png", "icons/icon-180.png", "icons/icon-192.png",
        "icons/icon-512.png", "icons/maskable-512.png",
      ];
      for (const name of [...shellFiles, ...assetPaths.map((asset) => asset.slice(1))]) {
        hash.update(name);
        hash.update(await readFile(path.join(outputDir, name)));
      }
      const version = hash.digest("hex").slice(0, 12);
      await writeFile(workerPath, renderOfflineWorker(source, assetPaths, version));
    },
  };
}
