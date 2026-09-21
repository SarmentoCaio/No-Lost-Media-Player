import { useCallback, useRef, useState } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { PlayerLaunch } from "../types/game";
import { GamePlayer } from "../components/GamePlayer";
import { PlayerToolbar } from "../components/PlayerToolbar";
import type { EmulatorJSPlayerHandle } from "../components/EmulatorJSPlayer";

interface PlayerProps {
  launch: PlayerLaunch;
  onBack: () => void;
}

export function Player({ launch, onBack }: PlayerProps) {
  const playerContainer = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<EmulatorJSPlayerHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [n64Core, setN64Core] = useState(emulatorConfig.n64.core);
  const handleError = useCallback((message: string) => setError(message), []);

  return (
    <main className="player-page">
      <header className="player-header">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> Voltar
        </button>
        <div className="player-title">
          <span>{emulatorConfig[launch.platform].shortName}</span>
          <h1>{launch.title}</h1>
        </div>
        <span className="header-spacer" aria-hidden="true" />
      </header>

      {error && (
        <div className="player-error" role="alert">
          <div>
            <strong>Não foi possível concluir a ação</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      <div className="player-shell" ref={playerContainer}>
        <GamePlayer
          platform={launch.platform}
          romUrl={launch.romUrl}
          gameId={launch.gameId}
          gameName={launch.title}
          core={launch.platform === "n64" ? n64Core : undefined}
          playerRef={emulatorRef}
          onReady={setPlayerReady}
          onError={handleError}
        />
      </div>

      <PlayerToolbar
        playerContainer={playerContainer}
        emulatorRef={emulatorRef}
        gameId={launch.gameId}
        platform={launch.platform}
        playerReady={playerReady}
        n64Core={launch.platform === "n64" ? n64Core : undefined}
        onN64CoreChange={launch.platform === "n64" ? (core) => {
          setError(null);
          setPlayerReady(false);
          setN64Core(core);
        } : undefined}
        onError={handleError}
      />
    </main>
  );
}
