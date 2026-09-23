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
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

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

      const controller = new AbortController();
      response.once("close", () => {
        if (!response.writableEnded) controller.abort();
      });
      try {
        const forwardHeaders = new Headers({ "User-Agent": "No-Lost-Media-Player/0.1" });
        if (typeof request.headers.range === "string") forwardHeaders.set("Range", request.headers.range);

        let currentUrl = targetUrl;
        let upstream: Response | null = null;

        for (let hop = 0; hop < 5; hop++) {
          upstream = await fetch(currentUrl, {
            method: request.method === "HEAD" ? "HEAD" : "GET",
            headers: forwardHeaders,
            redirect: "manual",
            signal: controller.signal,
          });

          if (upstream.status >= 300 && upstream.status < 400) {
            const location = upstream.headers.get("location");
            if (!location) break;
            const nextUrl = new URL(location, currentUrl);
            if (!isAllowedArchiveHost(nextUrl.hostname)) {
              response.statusCode = 400;
              response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
              response.end("Redirecionamento não permitido fora do Archive.org.");
              return;
            }
            nextUrl.pathname = nextUrl.pathname
              .split("/")
              .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
              .join("/");
            currentUrl = nextUrl.toString();
            continue;
          }
          break;
        }

        if (!upstream) {
          response.statusCode = 502;
          response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          response.end("Não foi possível conectar ao Archive.org.");
          return;
        }

        response.statusCode = upstream.status;
        for (const name of ["accept-ranges", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
          const value = upstream.headers.get(name);
          if (value) response.setHeader(name, value);
        }
        const isSuccess = upstream.status === 200 || upstream.status === 206;
        response.setHeader(
          "Cache-Control",
          isSuccess ? "public, max-age=2592000, immutable" : "no-cache, no-store, must-revalidate",
        );

        if (request.method === "HEAD" || !upstream.body) {
          response.end();
          return;
        }
        for await (const chunk of upstream.body) response.write(chunk);
        response.end();
      } catch (error) {
        if (controller.signal.aborted) return;
        response.statusCode = 502;
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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
