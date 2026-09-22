import type { Ref } from "react";
import { EmulatorJSPlayer, type EmulatorJSPlayerHandle } from "./EmulatorJSPlayer";
import { PS2Player } from "./PS2Player";
import type { Platform } from "../types/game";
import type { RawKeyboardInput } from "../input/controlTypes";

interface GamePlayerProps {
  platform: Platform;
  romUrl: string;
  gameId: string;
  gameName?: string;
  core?: string;
  volume?: number;
  keyboardCodes?: string[];
  onKeyboardInput?: (input: RawKeyboardInput) => void;
  playerRef?: Ref<EmulatorJSPlayerHandle>;
  onReady?: (ready: boolean) => void;
  onError?: (message: string) => void;
}

export function GamePlayer({
  platform,
  romUrl,
  gameId,
  gameName = "Jogo",
  core,
  volume = 0.8,
  keyboardCodes = [],
  onKeyboardInput = () => undefined,
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
      gameId={gameId}
      gameName={gameName}
      core={core}
      volume={volume}
      keyboardCodes={keyboardCodes}
      onKeyboardInput={onKeyboardInput}
      onReady={onReady}
      onError={onError}
    />
  );
}
