import type { Platform } from "../types/game";

export type EmulatorEngine = "emulatorjs" | "play";

export interface EmulatorPlatformConfig {
  id: Platform;
  name: string;
  shortName: string;
  engine: EmulatorEngine;
  core: string;
  extensions: readonly string[];
  extensionLabel: string;
  accent: string;
}
