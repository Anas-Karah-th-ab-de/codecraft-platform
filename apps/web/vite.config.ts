import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Entwicklung: `npm run dev` → http://localhost:5173, API wird an den Rust-Server weitergeleitet
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://127.0.0.1:8080", ws: true }, "/health": "http://127.0.0.1:8080" } },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 600 },
});
