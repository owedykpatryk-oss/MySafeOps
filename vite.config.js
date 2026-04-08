import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lucide-react")) return "lucide";
          if (id.includes("react-router")) return "router";
          // One vendor chunk for React + deps avoids Rollup circular-chunk warnings (vendor ↔ react-vendor).
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
