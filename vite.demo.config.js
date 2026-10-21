// Build della preview demo: un unico file HTML, Supabase e AI simulati.
// npx vite build --config vite.demo.config.js  ->  dist-demo/index.html
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^\.\.?\/supabaseClient$/, replacement: here("./demo/mockSupabase.js") },
      { find: "heic2any", replacement: here("./demo/heicStub.js") },
    ],
  },
  build: { outDir: "dist-demo" },
  define: { __DEMO__: "true" },
});
