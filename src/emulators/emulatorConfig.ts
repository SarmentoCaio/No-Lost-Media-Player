import type { EmulatorPlatformConfig } from "./emulatorTypes";
import type { Platform } from "../types/game";

export const emulatorConfig: Record<Platform, EmulatorPlatformConfig> = {
  nes: {
    id: "nes",
    name: "Nintendo Entertainment System",
    shortName: "NES",
    engine: "emulatorjs",
    core: "fceumm",
    extensions: [".nes", ".zip"],
    extensionLabel: ".nes ou .zip",
    accent: "#ef4444",
    accentSecondary: "#f5f5f4",
    manufacturer: "Nintendo",
    era: "8-bit · 1983",
  },
  snes: {
    id: "snes",
    name: "Super Nintendo",
    shortName: "SNES",
    engine: "emulatorjs",
    core: "snes9x",
    extensions: [".sfc", ".smc", ".zip"],
    extensionLabel: ".sfc, .smc ou .zip",
    accent: "#a98cff",
    accentSecondary: "#ef5d8f",
    manufacturer: "Nintendo",
    era: "16-bit · 1990",
  },
  gba: {
    id: "gba",
    name: "Game Boy Advance",
    shortName: "GBA",
    engine: "emulatorjs",
    core: "mgba",
    extensions: [".gba", ".zip"],
    extensionLabel: ".gba ou .zip",
    accent: "#8b7cff",
    accentSecondary: "#d8b4fe",
    manufacturer: "Nintendo",
    era: "Portátil 32-bit · 2001",
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
    accentSecondary: "#ffd84d",
    manufacturer: "Nintendo",
    era: "64-bit · 1996",
  },
  ps1: {
    id: "ps1",
    name: "PlayStation",
    shortName: "PS1",
    engine: "emulatorjs",
    // PCSX-ReARMed usa uma BIOS HLE quando o usuário não fornece uma BIOS real.
    // O antigo mednafen_psx_hw interrompia a inicialização pedindo scph5500.bin.
    core: "pcsx_rearmed",
    extensions: [".chd", ".bin", ".cue", ".pbp"],
    extensionLabel: ".chd, .bin/.cue ou .pbp",
    accent: "#67b8ff",
    accentSecondary: "#f15b6c",
    manufacturer: "Sony Computer Entertainment",
    era: "32-bit · 1994",
  },
  ps2: {
    id: "ps2",
    name: "PlayStation 2",
    shortName: "PS2",
    engine: "play",
    core: "play",
    extensions: [".iso", ".bin", ".chd", ".cso"],
    extensionLabel: ".iso, .bin, .chd ou .cso",
    accent: "#ff8b72",
    accentSecondary: "#4ea8ff",
    manufacturer: "Sony Computer Entertainment",
    era: "128-bit · 2000",
  },
};

export const platforms = Object.values(emulatorConfig);
export const availablePlatforms = platforms.filter((platform) => (
  platform.id !== "ps2" || import.meta.env.VITE_PS2_ENABLED !== "false"
));

export function isPlatform(value: string): value is Platform {
  return value in emulatorConfig;
}
