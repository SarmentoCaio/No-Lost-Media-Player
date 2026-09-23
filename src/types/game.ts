export type Platform = "nes" | "snes" | "gba" | "n64" | "ps1" | "ps2";

export interface Game {
  id: string;
  title: string;
  platform: Platform;
  romUrl?: string;
  coverUrl?: string;
}

export interface PlayerLaunch {
  gameId: string;
  title: string;
  platform: Platform;
  romUrl: string;
  romFile?: File;
  source: "url" | "local";
}
