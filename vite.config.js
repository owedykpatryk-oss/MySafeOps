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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "lucide";
          if (id.includes("react-router")) return "router";
          // One vendor chunk for React + other deps avoids Rollup circular-chunk warnings.
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
