import { useMemo, type Ref } from "react";
import { EmulatorJSPlayer } from "./EmulatorJSPlayer";
import { PS2Player } from "./PS2Player";
import type { Platform } from "../types/game";
import type { PlayerAdapter, RomSource } from "../emulators/PlayerAdapter";

interface GamePlayerProps {
  platform: Platform;
  romUrl: string;
  romFile?: File;
  gameId: string;
  gameName?: string;
  core?: string;
  playerRef?: Ref<PlayerAdapter>;
  onReady?: (ready: boolean) => void;
  onError?: (message: string) => void;
}

export function GamePlayer({
  platform,
  romUrl,
  romFile,
  gameId,
  gameName = "Jogo",
  core,
  playerRef,
  onReady,
  onError = () => undefined,
}: GamePlayerProps) {
  const ps2Source = useMemo<RomSource>(() => romFile
    ? { kind: "file", file: romFile, name: romFile.name }
    : { kind: "url", url: romUrl, name: gameName }, [gameName, romFile, romUrl]);

  if (platform === "ps2") {
    return (
      <PS2Player
        ref={playerRef}
        source={ps2Source}
        gameName={gameName}
        onReady={onReady}
        onError={onError}
      />
    );
  }

  return (
    <EmulatorJSPlayer
      ref={playerRef}
      platform={platform}
      romUrl={romUrl}
      gameId={gameId}
      gameName={gameName}
      core={core}
      onReady={onReady}
      onError={onError}
    />
  );
}
