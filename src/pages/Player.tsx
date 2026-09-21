import { useCallback, useRef, useState } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { PlayerLaunch } from "../types/game";
import { GamePlayer } from "../components/GamePlayer";
import { PlayerToolbar } from "../components/PlayerToolbar";

interface PlayerProps {
  launch: PlayerLaunch;
  onBack: () => void;
}

export function Player({ launch, onBack }: PlayerProps) {
  const playerContainer = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
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
            <strong>Não foi possível carregar a ROM</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      <div className="player-shell" ref={playerContainer}>
        <GamePlayer
          platform={launch.platform}
          romUrl={launch.romUrl}
          gameName={launch.title}
          onError={handleError}
        />
      </div>

      <PlayerToolbar playerContainer={playerContainer} onError={handleError} />
    </main>
  );
}
