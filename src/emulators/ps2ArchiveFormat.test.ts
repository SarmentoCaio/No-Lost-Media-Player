import { describe, expect, it } from "vitest";
import { isPs2Archive, parseSevenZipListing } from "./ps2ArchiveFormat";

describe("PS2 compressed archives", () => {
  it.each(["game.7z", "GAME.RAR", "game.zip"])("recognizes %s", (name) => {
    expect(isPs2Archive(name)).toBe(true);
  });

  it("selects supported disc images and prefers the largest one", () => {
    const listing = `
Path = archive.7z
Type = 7z
Physical Size = 123

----------
Path = notes.txt
Size = 42

----------
Path = game.cue
Size = 128

----------
Path = game.iso
Size = 4700000000

----------
Path = bonus.bin
Size = 700000000
`;
    expect(parseSevenZipListing(listing)).toEqual([
      { path: "game.iso", size: 4_700_000_000 },
      { path: "bonus.bin", size: 700_000_000 },
    ]);
  });
});
