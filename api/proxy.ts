import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

export const maxDuration = 300;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
      res.setHeader("Access-Control-Max-Age", "86400");
      return res.end();
    }

    const host = req.headers.host || "localhost";
    const urlObj = new URL(req.url || "", `https://${host}`);
    let targetUrl = urlObj.searchParams.get("url");

    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.end(JSON.stringify({ error: "Parâmetro url é obrigatório." }));
    }

    // Normaliza e desfaz eventual dupla codificação de URLs
    while (targetUrl.includes("%25")) {
      try {
        targetUrl = decodeURIComponent(targetUrl);
      } catch {
        break;
      }
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Protocolo inválido");
      }
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.end(JSON.stringify({ error: "URL informada é inválida." }));
    }

    const clientRange = req.headers["range"];

    // Gerenciamento manual de redirecionamentos contra instabilidade de nós do Archive.org
    let currentUrl = parsedUrl.href;
    let redirects = 0;
    const maxRedirects = 6;
    let upstreamResponse: Response | null = null;

    while (redirects < maxRedirects) {
      const forwardHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: typeof req.headers.accept === "string" ? req.headers.accept : "*/*",
      };
      if (clientRange) {
        forwardHeaders["Range"] = String(clientRange);
      }

      try {
        const resp = await fetch(currentUrl, {
          method: req.method === "HEAD" ? "HEAD" : "GET",
          headers: forwardHeaders,
          redirect: "manual",
        });

        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get("location");
          if (!location) {
            break;
          }
          currentUrl = new URL(location, currentUrl).href;
          redirects++;
          continue;
        }

        upstreamResponse = resp;
        break;
      } catch (err: any) {
        break;
      }
    }

    if (!upstreamResponse) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.end(JSON.stringify({ error: "Falha ao contatar acervo remoto." }));
    }

    res.statusCode = upstreamResponse.status;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges, Content-Disposition"
    );
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    // no-transform impede buffers de CDN/Edge intermediários de reterem payloads grandes
    res.setHeader("Cache-Control", "no-cache, no-transform");

    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const contentLength = upstreamResponse.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    const contentRange = upstreamResponse.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);

    const acceptRanges = upstreamResponse.headers.get("accept-ranges");
    res.setHeader("Accept-Ranges", acceptRanges || "bytes");

    if (req.method === "HEAD") {
      return res.end();
    }

    // Libera os cabeçalhos para o cliente imediatamente
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    if (upstreamResponse.body) {
      const nodeStream = Readable.fromWeb(upstreamResponse.body as any);

      nodeStream.on("error", (streamErr) => {
        console.error("Erro no stream upstream:", streamErr);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "Erro de streaming do acervo remoto." }));
        } else {
          res.destroy();
        }
      });

      res.on("error", (resErr) => {
        console.error("Erro na resposta downstream:", resErr);
        nodeStream.destroy();
      });

      req.on("close", () => {
        nodeStream.destroy();
      });

      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (handlerErr: any) {
    console.error("Exceção geral no proxy:", handlerErr);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.end(JSON.stringify({
        error: "Falha interna no proxy",
        message: handlerErr?.message || String(handlerErr)
      }));
    } else {
      res.destroy();
    }
  }
}
