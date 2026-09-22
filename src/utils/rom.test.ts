import { describe, expect, it } from "vitest";
import { isSupportedRom } from "./rom";

describe("PS2 ROM formats", () => {
  it.each(["game.iso", "game.bin", "game.chd", "game.cso"])("accepts %s", (fileName) => {
    expect(isSupportedRom(fileName, "ps2")).toBe(true);
  });

  it("handles BIN extensions case-insensitively", () => {
    expect(isSupportedRom("GAME.BIN", "ps2")).toBe(true);
  });
});
