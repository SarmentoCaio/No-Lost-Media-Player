import { emulatorConfig } from "../emulators/emulatorConfig";
import type { Platform } from "../types/game";

export function getFileExtension(fileName: string): string {
  const cleanName = fileName.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
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
  const cleanName = sourceName.split(/[?#]/, 1)[0]?.split("/").pop() ?? "";
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
