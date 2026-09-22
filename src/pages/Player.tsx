import { useCallback, useRef, useState, type CSSProperties } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { PlayerLaunch } from "../types/game";
import { GamePlayer } from "../components/GamePlayer";
import { PlayerToolbar } from "../components/PlayerToolbar";
import {
  EMULATOR_JS_CAPABILITIES,
  PLAY_PS2_CAPABILITIES,
  type PlayerAdapter,
} from "../emulators/PlayerAdapter";
import { PlatformIcon } from "../components/PlatformIcon";

interface PlayerProps {
  launch: PlayerLaunch;
  onBack: () => void;
}

export function Player({ launch, onBack }: PlayerProps) {
  const playerContainer = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<PlayerAdapter>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerInstance, setPlayerInstance] = useState(0);
  const [n64Core, setN64Core] = useState(emulatorConfig.n64.core);
  const handleError = useCallback((message: string) => setError(message), []);
  const config = emulatorConfig[launch.platform];

  const restartPlayer = async () => {
    await emulatorRef.current?.destroy().catch(() => undefined);
    setError(null);
    setPlayerReady(false);
    setPlayerInstance((current) => current + 1);
  };

  const leavePlayer = async () => {
    await emulatorRef.current?.destroy().catch(() => undefined);
    onBack();
  };

  const themeStyle = {
    "--console-accent": config.accent,
    "--console-accent-secondary": config.accentSecondary,
  } as CSSProperties;

  return (
    <main className={`player-page player-theme--${launch.platform}`} style={themeStyle}>
      <header className="player-header">
        <button className="back-button" type="button" onClick={() => void leavePlayer()}>
          <span aria-hidden="true">←</span> Voltar
        </button>
        <div className="player-console-identity">
          <span className="player-console-mark" aria-hidden="true">
            <PlatformIcon platform={launch.platform} />
          </span>
          <div className="player-title">
            <span>{config.manufacturer} · {config.shortName}</span>
            <h1>{launch.title}</h1>
            <small>{config.name} · {config.era}</small>
          </div>
        </div>
        <div className={`player-runtime-status${playerReady ? " player-runtime-status--ready" : ""}`}>
          <span aria-hidden="true" />
          {playerReady ? "Emulação ativa" : "Inicializando"}
        </div>
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
        <div className="player-shell-brand" aria-hidden="true">
          <span>{config.shortName}</span>
          <i /><i />
        </div>
        <GamePlayer
          key={`${launch.gameId}-${n64Core}-${playerInstance}`}
          platform={launch.platform}
          romUrl={launch.romUrl}
          romFile={launch.romFile}
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
        capabilities={launch.platform === "ps2" ? PLAY_PS2_CAPABILITIES : EMULATOR_JS_CAPABILITIES}
        n64Core={launch.platform === "n64" ? n64Core : undefined}
        onN64CoreChange={launch.platform === "n64" ? (core) => {
          setError(null);
          setPlayerReady(false);
          setN64Core(core);
        } : undefined}
        onRestart={restartPlayer}
        onError={handleError}
      />
    </main>
  );
}
