import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// heic2any è pesante ma viene scaricato solo se serve convertire un HEIC
export default defineConfig({ plugins: [react()], build: { chunkSizeWarningLimit: 1500 }, define: { __DEMO__: "false" } });
