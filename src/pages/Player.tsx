import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { PlayerLaunch } from "../types/game";
import { GamePlayer } from "../components/GamePlayer";
import { PlayerToolbar } from "../components/PlayerToolbar";
import type { EmulatorJSPlayerHandle } from "../components/EmulatorJSPlayer";
import { PlatformIcon } from "../components/PlatformIcon";
import { useInputManager } from "../hooks/useInputManager";
import { loadAudioSettings, loadControlSettings, saveAudioSettings } from "../input/settingsStorage";
import type { AudioSettings, PlayablePlatform } from "../input/controlTypes";
import { TouchController } from "../components/controls/TouchController";
import { ControlsPanel } from "../components/controls/ControlsPanel";
import { TouchEditor } from "../components/controls/TouchEditor";
import { VolumeControl } from "../components/controls/VolumeControl";

interface PlayerProps {
  launch: PlayerLaunch;
  onBack: () => void;
}

export function Player({ launch, onBack }: PlayerProps) {
  const playerContainer = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<EmulatorJSPlayerHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerInstance, setPlayerInstance] = useState(0);
  const [n64Core, setN64Core] = useState(emulatorConfig.n64.core);
  const inputPlatform: PlayablePlatform = launch.platform === "ps2" ? "ps1" : launch.platform;
  const [controlSettings, setControlSettings] = useState(() => loadControlSettings(inputPlatform));
  const [audio, setAudio] = useState(loadAudioSettings);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [touchEditorOpen, setTouchEditorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleError = useCallback((message: string) => setError(message), []);
  const config = emulatorConfig[launch.platform];
  const { manager, snapshot, handleIframeKeyboard } = useInputManager(inputPlatform, controlSettings, emulatorRef);

  const keyboardCodes = useMemo(() => Object.values(controlSettings.keyboard), [controlSettings.keyboard]);
  const effectiveVolume = audio.muted ? 0 : audio.volume;
  const changeAudio = useCallback((next: AudioSettings) => {
    setAudio(next);
    saveAudioSettings(next);
    emulatorRef.current?.setVolume(next.muted ? 0 : next.volume);
  }, []);

  useEffect(() => {
    manager.setEnabled(!touchEditorOpen);
    if (touchEditorOpen) emulatorRef.current?.releaseAllInputs();
  }, [manager, touchEditorOpen]);

  const restartPlayer = () => {
    setError(null);
    setPlayerReady(false);
    setPlayerInstance((current) => current + 1);
  };

  const themeStyle = {
    "--console-accent": config.accent,
    "--console-accent-secondary": config.accentSecondary,
  } as CSSProperties;

  return (
    <main className={`player-page player-theme--${launch.platform}`} style={themeStyle}>
      <header className="player-header">
        <button className="back-button" type="button" onClick={onBack}>
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
          gameId={launch.gameId}
          gameName={launch.title}
          core={launch.platform === "n64" ? n64Core : undefined}
          volume={effectiveVolume}
          keyboardCodes={keyboardCodes}
          onKeyboardInput={handleIframeKeyboard}
          playerRef={emulatorRef}
          onReady={setPlayerReady}
          onError={handleError}
        />
        {launch.platform !== "ps2" && (
          <TouchController
            platform={inputPlatform}
            settings={controlSettings}
            snapshot={snapshot}
            manager={manager}
            disabled={touchEditorOpen}
          />
        )}
        {launch.platform !== "ps2" && (
          <div className="mobile-game-menu">
            <button type="button" className="mobile-game-menu__toggle" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Menu do jogo">☰</button>
            {mobileMenuOpen && (
              <div className="mobile-game-menu__panel">
                <strong>Menu do jogo</strong>
                <VolumeControl audio={audio} onChange={changeAudio} />
                <button type="button" onClick={() => { setControlsOpen(true); setMobileMenuOpen(false); }}>Controles</button>
                <button type="button" onClick={() => { setTouchEditorOpen(true); setMobileMenuOpen(false); }}>Editar touch</button>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("no-lost-player-command", { detail: "save" }))}>Salvar</button>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("no-lost-player-command", { detail: "load" }))}>Carregar</button>
                <button type="button" onClick={() => { restartPlayer(); setMobileMenuOpen(false); }}>Reiniciar</button>
                <button type="button" onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void playerContainer.current?.requestFullscreen();
                  setMobileMenuOpen(false);
                }}>Alternar tela cheia</button>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>Continuar</button>
              </div>
            )}
          </div>
        )}
        {touchEditorOpen && launch.platform !== "ps2" && (
          <TouchEditor
            platform={inputPlatform}
            settings={controlSettings}
            onChange={setControlSettings}
            onClose={() => setTouchEditorOpen(false)}
          />
        )}
        {launch.platform !== "ps2" && (
          <ControlsPanel
            open={controlsOpen}
            currentPlatform={inputPlatform}
            currentSettings={controlSettings}
            snapshot={snapshot}
            manager={manager}
            onCurrentSettingsChange={setControlSettings}
            onClose={() => setControlsOpen(false)}
            onEditTouch={() => { setControlsOpen(false); setTouchEditorOpen(true); }}
          />
        )}
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
        onRestart={restartPlayer}
        onError={handleError}
        gamepadName={snapshot.gamepadName}
        audio={audio}
        onAudioChange={changeAudio}
        onOpenControls={() => setControlsOpen(true)}
      />
    </main>
  );
}
