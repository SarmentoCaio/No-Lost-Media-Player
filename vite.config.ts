import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

function isAllowedArchiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "archive.org" || url.hostname.endsWith(".archive.org"));
  } catch {
    return false;
  }
}

function archiveRomProxy(): Plugin {
  const install = (middlewares: { use: (route: string, handler: (request: any, response: any) => void) => void }) => {
    middlewares.use("/api/rom", async (request: any, response: any) => {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const target = requestUrl.searchParams.get("url") ?? "";
      if (!isAllowedArchiveUrl(target)) {
        response.statusCode = 400;
        response.end("Apenas URLs HTTPS do Archive.org podem usar este proxy.");
        return;
      }

      const controller = new AbortController();
      response.once("close", () => {
        if (!response.writableEnded) controller.abort();
      });
      try {
        const headers = new Headers({ "User-Agent": "No-Lost-Media-Player/0.1" });
        if (typeof request.headers.range === "string") headers.set("Range", request.headers.range);
        const upstream = await fetch(target, { headers, redirect: "follow", signal: controller.signal });
        response.statusCode = upstream.status;
        for (const name of ["accept-ranges", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
          const value = upstream.headers.get(name);
          if (value) response.setHeader(name, value);
        }
        response.setHeader("Cache-Control", "public, max-age=3600");
        if (!upstream.body) {
          response.end();
          return;
        }
        for await (const chunk of upstream.body) response.write(chunk);
        response.end();
      } catch (error) {
        if (controller.signal.aborted) return;
        response.statusCode = 502;
        response.end(error instanceof Error ? error.message : "Falha ao baixar a ROM.");
      }
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
