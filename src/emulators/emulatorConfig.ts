import type { EmulatorPlatformConfig } from "./emulatorTypes";
import type { Platform } from "../types/game";

export const emulatorConfig: Record<Platform, EmulatorPlatformConfig> = {
  snes: {
    id: "snes",
    name: "Super Nintendo",
    shortName: "SNES",
    engine: "emulatorjs",
    core: "snes9x",
    extensions: [".sfc", ".smc", ".zip"],
    extensionLabel: ".sfc, .smc ou .zip",
    accent: "#a98cff",
  },
  n64: {
    id: "n64",
    name: "Nintendo 64",
    shortName: "N64",
    engine: "emulatorjs",
    core: "mupen64plus_next",
    extensions: [".z64", ".n64", ".v64", ".zip"],
    extensionLabel: ".z64, .n64, .v64 ou .zip",
    accent: "#5bd69b",
  },
  ps1: {
    id: "ps1",
    name: "PlayStation",
    shortName: "PS1",
    engine: "emulatorjs",
    core: "mednafen_psx_hw",
    extensions: [".chd", ".bin", ".cue", ".pbp"],
    extensionLabel: ".chd, .bin/.cue ou .pbp",
    accent: "#67b8ff",
  },
  ps2: {
    id: "ps2",
    name: "PlayStation 2",
    shortName: "PS2",
    engine: "play",
    core: "play",
    extensions: [".iso", ".chd", ".cso"],
    extensionLabel: ".iso, .chd ou .cso",
    accent: "#ff8b72",
  },
};

export const platforms = Object.values(emulatorConfig);

export function isPlatform(value: string): value is Platform {
  return value in emulatorConfig;
}
