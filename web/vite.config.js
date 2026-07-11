import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React frontend is a client-side SPA that talks to the same Express API
// as the original site. In dev, proxy /api to the local backend (port 4600) so
// same-origin calls work exactly like production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4600", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
