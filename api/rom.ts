export const config = { runtime: "edge" };

function isAllowedArchiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "archive.org" || url.hostname.endsWith(".archive.org"));
  } catch {
    return false;
  }
}

export default async function handler(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url") ?? "";
  if (!isAllowedArchiveUrl(target)) {
    return new Response("Apenas URLs HTTPS do Archive.org podem usar este proxy.", { status: 400 });
  }

  const headers = new Headers({ "User-Agent": "No-Lost-Media-Player/0.1" });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  try {
    const upstream = await fetch(target, { headers, redirect: "follow" });
    const responseHeaders = new Headers({
      "Cache-Control": "public, max-age=3600",
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    });
    for (const name of ["accept-ranges", "content-length", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return new Response("Não foi possível baixar a ROM do Archive.org.", { status: 502 });
  }
}
