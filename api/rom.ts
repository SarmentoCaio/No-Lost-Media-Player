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

  const forwardHeaders = new Headers({
    "User-Agent": "No-Lost-Media-Player/0.1",
  });
  const range = request.headers.get("range");
  if (range) forwardHeaders.set("Range", range);

  try {
    let currentUrl = targetUrl;
    let upstream: Response | null = null;

    for (let hop = 0; hop < 5; hop++) {
      upstream = await fetch(currentUrl, {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        headers: forwardHeaders,
        redirect: "manual",
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("location");
        if (!location) break;
        const nextUrl = new URL(location, currentUrl);
        if (!isAllowedArchiveHost(nextUrl.hostname)) {
          return new Response("Redirecionamento não permitido fora do Archive.org.", {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
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
      return new Response("Não foi possível conectar ao Archive.org.", {
        status: 502,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const isSuccess = upstream.status === 200 || upstream.status === 206;
    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": isSuccess
        ? "public, max-age=2592000, immutable"
        : "no-cache, no-store, must-revalidate",
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    });

    for (const name of ["accept-ranges", "content-length", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response("Não foi possível baixar a ROM do Archive.org.", {
      status: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }
}
