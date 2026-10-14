import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development /api calls go to the local Nigeria API (server/, port 5050).
const api = { "/api": { target: "http://localhost:5050", changeOrigin: true } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: api },
  preview: { proxy: api },
});
