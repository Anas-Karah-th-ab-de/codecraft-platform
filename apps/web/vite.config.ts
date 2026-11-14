import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Stand der Oberfläche für die Anzeige im Portal/in der App: Build-Zeit (UTC) und Git-Stand
const rev = (() => {
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
})();
const build = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC${rev ? ` · ${rev}` : ""}`;

// Entwicklung: `npm run dev` → http://localhost:5173, API wird an den Rust-Server weitergeleitet
export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(build) },
  server: { proxy: { "/api": { target: "http://127.0.0.1:8080", ws: true }, "/health": "http://127.0.0.1:8080" } },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 600 },
});
