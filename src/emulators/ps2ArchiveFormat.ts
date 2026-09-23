export const PS2_ARCHIVE_EXTENSIONS = [".7z", ".rar", ".zip"] as const;
export const PS2_DISC_EXTENSIONS = [".iso", ".bin", ".chd", ".cso"] as const;

export interface ArchiveDiscEntry {
  path: string;
  size: number;
}

export function extensionOf(value: string): string {
  const clean = value.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  const index = clean.lastIndexOf(".");
  return index < 0 ? "" : clean.slice(index);
}

export function isPs2Archive(value: string): boolean {
  return (PS2_ARCHIVE_EXTENSIONS as readonly string[]).includes(extensionOf(value));
}

export function isPs2DiscImage(value: string): boolean {
  return (PS2_DISC_EXTENSIONS as readonly string[]).includes(extensionOf(value));
}

export function parseSevenZipListing(output: string): ArchiveDiscEntry[] {
  const entries: ArchiveDiscEntry[] = [];
  let path = "";
  let size: number | null = null;

  const commit = () => {
    if (path && size !== null && Number.isSafeInteger(size) && size > 0 && isPs2DiscImage(path)) {
      entries.push({ path, size });
    }
    path = "";
    size = null;
  };

  for (const rawLine of output.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (line === "----------") {
      commit();
      continue;
    }
    if (line.startsWith("Path = ")) path = line.slice(7).trim();
    else if (line.startsWith("Size = ")) size = Number(line.slice(7).trim());
  }
  commit();
  return entries.sort((left, right) => right.size - left.size);
}
