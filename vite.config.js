import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "lucide";
          if (id.includes("react-router")) return "router";
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
});
