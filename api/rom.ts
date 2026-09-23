export const config = { runtime: "edge" };

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

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const requestUrl = new URL(request.url);
  const rawTarget = requestUrl.searchParams.get("url") ?? "";
  const targetUrl = cleanArchiveUrl(rawTarget);

  if (!targetUrl) {
    return new Response("Apenas URLs HTTPS do Archive.org podem usar este proxy.", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // Redireciona diretamente para o endpoint oficial de CORS do Archive.org (/cors/)
  // que fornece cabeçalhos ACAO nativos e download direto pelo browser em alta velocidade.
  return new Response(null, {
    status: 307,
    headers: {
      Location: targetUrl,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
