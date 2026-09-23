import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

function isAllowedArchiveHost(hostname: string): boolean {
  return hostname === "archive.org" || hostname.endsWith(".archive.org");
}

function cleanArchiveUrl(raw: string): string | null {
  try {
    let clean = raw.trim();
    while (clean.includes("%25")) {
      try { clean = decodeURIComponent(clean); } catch { break; }
    }
    const url = new URL(clean);
    if (url.protocol !== "https:" || !isAllowedArchiveHost(url.hostname)) {
      return null;
    }
    url.pathname = url.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    if (url.pathname.startsWith("/download/")) {
      url.pathname = url.pathname.replace(/^\/download\//, "/cors/");
    }
    return url.toString();
  } catch {
    return null;
  }
}

function archiveRomProxy(): Plugin {
  const install = (middlewares: { use: (route: string, handler: (request: any, response: any) => void) => void }) => {
    middlewares.use("/api/rom", async (request: any, response: any) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "*");

      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const rawTarget = requestUrl.searchParams.get("url") ?? "";
      const targetUrl = cleanArchiveUrl(rawTarget);
      if (!targetUrl) {
        response.statusCode = 400;
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        response.end("Apenas URLs HTTPS do Archive.org podem usar este proxy.");
        return;
      }

      response.statusCode = 307;
      response.setHeader("Location", targetUrl);
      response.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      response.end();
    });
  };

  return {
    name: "archive-rom-proxy",
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), archiveRomProxy()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
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
