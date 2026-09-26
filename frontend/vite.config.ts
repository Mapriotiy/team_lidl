import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts and its d3 dependencies are most of the bundle and change
        // far less often than the app, so they get their own cacheable chunk.
        manualChunks: {
          charts: ["recharts"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
