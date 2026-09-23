import { emulatorConfig } from "../emulators/emulatorConfig";
import type { Platform } from "../types/game";

export function getFileExtension(fileName: string): string {
  let effective = fileName;
  if (fileName.includes("/api/proxy?url=")) {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
      const parsed = new URL(fileName, base);
      const urlParam = parsed.searchParams.get("url");
      if (urlParam) effective = urlParam;
    } catch {
      // fallback
    }
  }
  const cleanName = effective.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  const dotIndex = cleanName.lastIndexOf(".");
  return dotIndex >= 0 ? cleanName.slice(dotIndex) : "";
}

export function isSupportedRom(fileName: string, platform: Platform): boolean {
  return emulatorConfig[platform].extensions.includes(getFileExtension(fileName));
}

export function validateRemoteRomUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Informe a URL da ROM ou selecione um arquivo local.";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Use uma URL iniciada por http:// ou https://.";
    }
    return null;
  } catch {
    return "A URL informada não é válida.";
  }
}

export function titleFromRom(sourceName: string, fallback: string): string {
  let effectiveSource = sourceName;
  if (sourceName.includes("/api/proxy?url=")) {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
      const parsed = new URL(sourceName, base);
      const urlParam = parsed.searchParams.get("url");
      if (urlParam) effectiveSource = urlParam;
    } catch {
      // fallback
    }
  }

  const cleanName = effectiveSource.split(/[?#]/, 1)[0]?.split("/").pop() ?? "";
  const withoutExtension = cleanName.replace(/\.[^.]+$/, "");
  if (!withoutExtension) return fallback;
  try {
    return decodeURIComponent(withoutExtension).replace(/[-_]+/g, " ");
  } catch {
    return withoutExtension.replace(/[-_]+/g, " ");
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "jogo-local";
}

export function isProxiedRomUrl(url: string): boolean {
  return url.startsWith("/api/proxy") || url.includes("/api/proxy?url=");
}

export function isArchiveOrgUrl(url: string): boolean {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(url, base);
    return (
      parsed.hostname === "archive.org" ||
      parsed.hostname.endsWith(".archive.org")
    );
  } catch {
    return false;
  }
}

export function resolvePlayableRomUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (isProxiedRomUrl(trimmed)) {
    return trimmed;
  }
  while (trimmed.includes("%25")) {
    try {
      trimmed = decodeURIComponent(trimmed);
    } catch {
      break;
    }
  }
  if (isArchiveOrgUrl(trimmed)) {
    return `/api/proxy?url=${encodeURIComponent(trimmed)}&v=3`;
  }
  return trimmed;
}
