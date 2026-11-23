import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The page security headers are defined once, in vercel.json. `vite preview`
// serves the production build with the same headers, so the content security
// policy can be checked locally before deploying. (The dev server cannot use
// them: hot reload injects inline scripts the policy forbids.)
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const pageHeaders = Object.fromEntries(
  (vercel.headers.find((h) => h.source === "/(.*)")?.headers || []).map(({ key, value }) => [key, value]),
);

// In development /api is proxied to the local backend (port 4600), so the
// browser sees one origin, exactly as in production.
const apiProxy = { "/api": { target: "http://localhost:4600", changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, headers: pageHeaders, proxy: apiProxy },
  build: { outDir: "dist" },
});
