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
          rewrite: (path) => path.replace(/^\/api\/postcode\//, "/postcodes/"),
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
      include: ["src/**/*.test.{js,jsx}"],
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
              if (norm.includes("/modules/permits/PermitSystem")) return "permits";
              if (norm.includes("moduleCatalogIcons")) return "module-icons";
              return;
            }
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("lucide-react")) return "lucide";
            if (id.includes("react-router")) return "router";
            if (id.includes("leaflet")) return "leaflet";
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
