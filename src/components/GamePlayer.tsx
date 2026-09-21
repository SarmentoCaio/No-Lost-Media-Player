import type { Ref } from "react";
import { EmulatorJSPlayer, type EmulatorJSPlayerHandle } from "./EmulatorJSPlayer";
import { PS2Player } from "./PS2Player";
import type { Platform } from "../types/game";

interface GamePlayerProps {
  platform: Platform;
  romUrl: string;
  gameName?: string;
  core?: string;
  playerRef?: Ref<EmulatorJSPlayerHandle>;
  onReady?: (ready: boolean) => void;
  onError?: (message: string) => void;
}

export function GamePlayer({
  platform,
  romUrl,
  gameName = "Jogo",
  core,
  playerRef,
  onReady,
  onError = () => undefined,
}: GamePlayerProps) {
  if (platform === "ps2") {
    return <PS2Player romUrl={romUrl} gameName={gameName} />;
  }

  return (
    <EmulatorJSPlayer
      ref={playerRef}
      platform={platform}
      romUrl={romUrl}
      gameName={gameName}
      core={core}
      onReady={onReady}
      onError={onError}
    />
  );
}
