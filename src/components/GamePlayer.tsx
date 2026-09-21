import { EmulatorJSPlayer } from "./EmulatorJSPlayer";
import { PS2Player } from "./PS2Player";
import type { Platform } from "../types/game";

interface GamePlayerProps {
  platform: Platform;
  romUrl: string;
  gameName?: string;
  onError?: (message: string) => void;
}

export function GamePlayer({ platform, romUrl, gameName = "Jogo", onError = () => undefined }: GamePlayerProps) {
  if (platform === "ps2") {
    return <PS2Player romUrl={romUrl} gameName={gameName} />;
  }

  return (
    <EmulatorJSPlayer
      platform={platform}
      romUrl={romUrl}
      gameName={gameName}
      onError={onError}
    />
  );
}
