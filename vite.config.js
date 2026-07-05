import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

function supabaseDnsPrefetchOriginFromEnv(env) {
  const raw = String(env.VITE_SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseDnsOrigin = supabaseDnsPrefetchOriginFromEnv(env);
  const sentryAuthToken = String(env.SENTRY_AUTH_TOKEN || "").trim();
  const sentryOrg = String(env.SENTRY_ORG || "").trim();
  const sentryProject = String(env.SENTRY_PROJECT || "").trim();
  const sentryUploadEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject);

  return {
    server: {
      proxy: {
        "/api/postcode": {
          target: "https://api.postcodes.io",
          changeOrigin: true,
          rewrite: (path) => {
            const q = path.indexOf("?");
            const search = q >= 0 ? path.slice(q + 1) : "";
            const code = String(new URLSearchParams(search).get("code") || "")
              .replace(/\s/g, "")
              .toUpperCase();
            if (!code) return "/postcodes/invalid";
            return `/postcodes/${encodeURIComponent(code)}`;
          },
        },
      },
    },
    plugins: [
      react(),
      ...(sentryUploadEnabled
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              telemetry: false,
            }),
          ]
        : []),
      {
        name: "dev-legacy-postcode-api",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
            const pathOnly = req.url.split("?")[0];
            const m = pathOnly.match(/^\/api\/postcode\/([^/]+)$/);
            if (m) {
              req.url = `/api/postcode?code=${encodeURIComponent(m[1])}${req.url.includes("?") ? "&" + req.url.split("?")[1] : ""}`;
            }
            next();
          });
        },
      },
      {
        name: "dev-health-api",
        configureServer(server) {
          server.middlewares.use("/api/health", (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.statusCode = 200;
            if (req.method === "HEAD") {
              res.end();
              return;
            }
            res.end(JSON.stringify({ ok: true, ts: Date.now() }));
          });
        },
      },
      {
        name: "block-anthropic-key-in-production",
        config(_config, { mode }) {
          if (mode === "production" && String(env.VITE_ANTHROPIC_API_KEY || "").trim()) {
            throw new Error(
              "VITE_ANTHROPIC_API_KEY must not be set for production builds — use VITE_ANTHROPIC_PROXY_URL and server-side ANTHROPIC_API_KEY instead."
            );
          }
        },
      },
      {
        name: "block-openweather-key-in-production",
        config(_config, { mode }) {
          if (mode === "production" && String(env.VITE_OPENWEATHER_API_KEY || "").trim()) {
            throw new Error(
              "VITE_OPENWEATHER_API_KEY must not be set for production builds — use server-side OPENWEATHER_API_KEY with /api/weather instead."
            );
          }
        },
      },
      {
        name: "dev-weather-api",
        configureServer(server) {
          server.middlewares.use("/api/weather", async (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            const apiKey = String(env.OPENWEATHER_API_KEY || env.VITE_OPENWEATHER_API_KEY || "").trim();
            const q = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
            const params = new URLSearchParams(q);
            let lat = parseFloat(params.get("lat") || "");
            let lng = parseFloat(params.get("lng") || params.get("lon") || "");
            let postcodeMeta = "";
            const pcRaw = String(params.get("postcode") || params.get("code") || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
            if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && pcRaw) {
              try {
                const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pcRaw)}`, {
                  headers: { Accept: "application/json" },
                });
                if (pcRes.ok) {
                  const pcJson = await pcRes.json();
                  lat = Number(pcJson?.result?.latitude);
                  lng = Number(pcJson?.result?.longitude);
                  postcodeMeta = pcJson?.result?.postcode || pcRaw;
                }
              } catch {
                /* fall through */
              }
            }
            if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
              res.statusCode = pcRaw ? 404 : 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: pcRaw ? "postcode_not_found" : "invalid_coordinates" }));
              return;
            }
            if (!apiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "openweather_not_configured" }));
              return;
            }
            try {
              const u = new URL("https://api.openweathermap.org/data/2.5/weather");
              u.searchParams.set("lat", String(lat));
              u.searchParams.set("lon", String(lng));
              u.searchParams.set("appid", apiKey);
              u.searchParams.set("units", "metric");
              const upstream = await fetch(u.toString());
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              if (req.method === "HEAD") {
                res.end();
                return;
              }
              if (upstream.ok && postcodeMeta) {
                try {
                  const parsed = JSON.parse(text);
                  parsed._mysafeops = { postcode: postcodeMeta, lat, lng };
                  res.end(JSON.stringify(parsed));
                  return;
                } catch {
                  /* raw text */
                }
              }
              res.end(text);
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "weather_upstream_unreachable" }));
            }
          });
        },
      },
      {
        name: "dev-overpass-api",
        configureServer(server) {
          server.middlewares.use("/api/overpass", async (req, res, next) => {
            if (req.method !== "POST" && req.method !== "HEAD") return next();
            if (req.method === "HEAD") {
              res.statusCode = 204;
              res.end();
              return;
            }
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            let body = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_json" }));
              return;
            }
            const lat = Number(body.lat);
            const lng = Number(body.lng);
            const radiusM = Math.max(500, Math.min(50_000, Number(body.radiusM) || 25_000));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_coordinates" }));
              return;
            }
            const query = `
[out:json][timeout:15];
(
  node(around:${radiusM},${lat},${lng})["amenity"="hospital"];
  node(around:${radiusM},${lat},${lng})["healthcare"="hospital"];
);
out body;`.trim();
            try {
              const upstream = await fetch("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Accept: "application/json",
                  "User-Agent": "MySafeOps/1.0 (dev nearest hospital; mysafeops.com)",
                },
                body: `data=${encodeURIComponent(query)}`,
              });
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              res.end(text);
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "overpass_upstream_unreachable" }));
            }
          });
        },
      },
      {
        name: "inject-supabase-resource-hints",
        transformIndexHtml(html) {
          const site = String(env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");
          const ogImage = `${site}/blog/images/permit-to-work-app-uk-hero.png`;
          const ogAlt = "MySafeOps — UK construction RAMS, permits, and site safety workspace";
          const ogBlock = `    <meta property="og:url" content="${site}/" />\n    <meta property="og:image" content="${ogImage}" />\n    <meta property="og:image:alt" content="${ogAlt}" />\n    <meta name="twitter:image" content="${ogImage}" />\n    <meta name="twitter:image:alt" content="${ogAlt}" />\n`;
          let out = /<\/title>/i.test(html)
            ? html.replace(/<\/title>\s*/i, `</title>\n${ogBlock}`)
            : html.replace("</head>", `${ogBlock}</head>`);
          if (!supabaseDnsOrigin) return out;
          return out.replace(
            "</head>",
            `    <link rel="preconnect" href="${supabaseDnsOrigin}" crossorigin />\n    <link rel="dns-prefetch" href="${supabaseDnsOrigin}" />\n  </head>`
          );
        },
      },
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,jsx}", "api/**/*.test.js"],
    },
    build: {
      target: "es2022",
      sourcemap: sentryUploadEnabled ? "hidden" : false,
      reportCompressedSize: false,
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            const norm = id.replace(/\\/g, "/");
            if (!norm.includes("node_modules")) {
              if (
                norm.includes("/modules/rams/ramsHazardLibrary") ||
                norm.includes("/modules/rams/ramsAllHazards") ||
                norm.includes("/modules/rams/ramsHazardLibraryExtended") ||
                norm.includes("/modules/rams/ramsHazardLibraryPro")
              ) {
                return "rams-hazards";
              }
              if (norm.includes("/modules/rams/constructionQuickPacks")) return "rams-quick-packs";
              if (norm.includes("/modules/permits/PermitSystem")) return "permits";
              if (norm.includes("moduleCatalogIcons")) return "module-icons";
              return;
            }
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("lucide-react")) return "lucide";
            if (id.includes("react-router")) return "router";
            if (id.includes("leaflet")) return "leaflet";
            if (id.includes("pdfjs-dist") || id.includes("pdf.worker")) return "pdfjs";
            if (id.includes("dompurify")) return "dompurify";
            if (norm.includes("/modules/surveyReport/")) return "survey-report";
            if (id.includes("html2canvas") || id.includes("jspdf")) return "print-export";
            if (
              id.includes("/react/") ||
              id.includes("\\react\\") ||
              id.includes("react-dom") ||
              id.includes("scheduler")
            ) {
              return "react-core";
            }
            // Let Rollup split the remaining deps by async boundaries.
            // This keeps initial bundles leaner for landing-first visits.
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
