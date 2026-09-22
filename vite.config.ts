import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const productionContentSecurityPolicy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-pi7zvafmmHO/MwQ09zwpUmc2cyymVc7iYFkp7MFr39c=' https://cdn.emulatorjs.org; worker-src 'self' blob:; connect-src 'self' https: wss:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; frame-ancestors 'self'";
const developmentContentSecurityPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.emulatorjs.org; worker-src 'self' blob:; connect-src 'self' https: wss:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; frame-ancestors 'self'";

const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": productionContentSecurityPolicy,
};

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      ...securityHeaders,
      "Content-Security-Policy": developmentContentSecurityPolicy,
    },
  },
  preview: {
    headers: {
      ...securityHeaders,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        ps2: fileURLToPath(new URL("./emulator/ps2/index.html", import.meta.url)),
      },
    },
  },
});
