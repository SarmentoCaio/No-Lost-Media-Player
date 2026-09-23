import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { PlayerLaunch } from "../types/game";
import { GamePlayer } from "../components/GamePlayer";
import { PlayerToolbar } from "../components/PlayerToolbar";
import type { EmulatorJSPlayerHandle } from "../components/EmulatorJSPlayer";
import { PlatformIcon } from "../components/PlatformIcon";
import { useInputManager } from "../hooks/useInputManager";
import {
  loadAudioSettings,
  loadControlSettings,
  loadQuickActionSettings,
  saveAudioSettings,
} from "../input/settingsStorage";
import type { AudioSettings, PlayablePlatform, QuickActionId, RawKeyboardInput } from "../input/controlTypes";
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
  const inputPlatform: PlayablePlatform = launch.platform;
  const [controlSettings, setControlSettings] = useState(() => loadControlSettings(inputPlatform));
  const [audio, setAudio] = useState(loadAudioSettings);
  const [quickActionSettings, setQuickActionSettings] = useState(loadQuickActionSettings);
  const audioRef = useRef(audio);
  const quickActionSettingsRef = useRef(quickActionSettings);
  const [paused, setPaused] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [touchEditorOpen, setTouchEditorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleError = useCallback((message: string) => setError(message), []);
  const config = emulatorConfig[launch.platform];
  const { manager, snapshot, handleIframeKeyboard } = useInputManager(inputPlatform, controlSettings, emulatorRef);

  const keyboardCodes = useMemo(
    () => [...new Set([...Object.values(controlSettings.keyboard), ...Object.values(quickActionSettings)])],
    [controlSettings.keyboard, quickActionSettings],
  );
  const effectiveVolume = audio.muted ? 0 : audio.volume;
  const changeAudio = useCallback((next: AudioSettings) => {
    audioRef.current = next;
    setAudio(next);
    saveAudioSettings(next);
    emulatorRef.current?.setVolume(next.muted ? 0 : next.volume);
  }, []);

  useEffect(() => {
    quickActionSettingsRef.current = quickActionSettings;
  }, [quickActionSettings]);

  const togglePause = useCallback(() => {
    setPaused((current) => {
      emulatorRef.current?.setPaused(!current);
      return !current;
    });
  }, []);

  const runQuickAction = useCallback((input: RawKeyboardInput) => {
    const action = (Object.entries(quickActionSettingsRef.current) as [QuickActionId, string][])
      .find(([, code]) => code === input.code)?.[0];
    if (!action) return false;

    if (action === "fastForward") {
      if (launch.platform !== "ps2" && !input.repeat) emulatorRef.current?.setFastForward(input.pressed);
      return true;
    }
    if (!input.pressed || input.repeat) return true;

    if (action === "save" || action === "load") {
      if (launch.platform === "ps2") {
        setError("O runtime Play! atual ainda não oferece save states para PlayStation 2.");
      } else {
        window.dispatchEvent(new CustomEvent("no-lost-player-command", { detail: action }));
      }
    } else if (action === "pause") {
      togglePause();
    } else if (action === "mute") {
      const currentAudio = audioRef.current;
      if (currentAudio.muted || currentAudio.volume === 0) {
        const restored = Math.max(0.01, currentAudio.previousVolume || 0.8);
        changeAudio({ volume: restored, muted: false, previousVolume: restored });
      } else {
        changeAudio({ ...currentAudio, muted: true, previousVolume: currentAudio.volume });
      }
    } else if (action === "fullscreen") {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void playerContainer.current?.requestFullscreen();
    }
    return true;
  }, [changeAudio, launch.platform, togglePause]);

  const handleKeyboardInput = useCallback((input: RawKeyboardInput) => {
    if (!runQuickAction(input)) handleIframeKeyboard(input);
  }, [handleIframeKeyboard, runQuickAction]);

  useEffect(() => {
    const handleQuickKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || controlsOpen || touchEditorOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable=true]")) return;
      if (!Object.values(quickActionSettings).includes(event.code)) return;
      event.preventDefault();
      event.stopPropagation();
      runQuickAction({ code: event.code, pressed: event.type === "keydown", repeat: event.repeat });
    };
    window.addEventListener("keydown", handleQuickKey, true);
    window.addEventListener("keyup", handleQuickKey, true);
    return () => {
      window.removeEventListener("keydown", handleQuickKey, true);
      window.removeEventListener("keyup", handleQuickKey, true);
    };
  }, [controlsOpen, quickActionSettings, runQuickAction, touchEditorOpen]);

  useEffect(() => {
    manager.setEnabled(!touchEditorOpen);
    if (touchEditorOpen) emulatorRef.current?.releaseAllInputs();
  }, [manager, touchEditorOpen]);

  const restartPlayer = () => {
    setError(null);
    setPlayerReady(false);
    setPaused(false);
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
          romFile={launch.romFile}
          gameId={launch.gameId}
          gameName={launch.title}
          core={launch.platform === "n64" ? n64Core : undefined}
          volume={effectiveVolume}
          keyboardCodes={keyboardCodes}
          onKeyboardInput={handleKeyboardInput}
          playerRef={emulatorRef}
          onReady={setPlayerReady}
          onError={handleError}
        />
        <TouchController
          platform={inputPlatform}
          settings={controlSettings}
          snapshot={snapshot}
          manager={manager}
          disabled={touchEditorOpen}
        />
        <div className="mobile-game-menu">
            <button type="button" className="mobile-game-menu__toggle" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Menu do jogo">☰</button>
            {mobileMenuOpen && (
              <div className="mobile-game-menu__panel">
                <strong>Menu do jogo</strong>
                <VolumeControl audio={audio} onChange={changeAudio} />
                <button type="button" onClick={() => { setControlsOpen(true); setMobileMenuOpen(false); }}>Controles</button>
                <button type="button" onClick={() => { setTouchEditorOpen(true); setMobileMenuOpen(false); }}>Editar touch</button>
                {launch.platform !== "ps2" && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("no-lost-player-command", { detail: "save" }))}>Salvar</button>}
                {launch.platform !== "ps2" && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("no-lost-player-command", { detail: "load" }))}>Carregar</button>}
                <button type="button" onClick={togglePause}>{paused ? "Continuar" : "Pausar"}</button>
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
        {touchEditorOpen && (
          <TouchEditor
            platform={inputPlatform}
            settings={controlSettings}
            onChange={setControlSettings}
            onClose={() => setTouchEditorOpen(false)}
          />
        )}
        <ControlsPanel
            open={controlsOpen}
            currentPlatform={inputPlatform}
            currentSettings={controlSettings}
            quickActionSettings={quickActionSettings}
            snapshot={snapshot}
            manager={manager}
            onCurrentSettingsChange={setControlSettings}
            onQuickActionSettingsChange={setQuickActionSettings}
            onClose={() => setControlsOpen(false)}
            onEditTouch={() => { setControlsOpen(false); setTouchEditorOpen(true); }}
        />
      </div>

      <PlayerToolbar
        playerContainer={playerContainer}
        emulatorRef={emulatorRef}
        gameId={launch.gameId}
        platform={launch.platform}
        playerReady={playerReady}
        paused={paused}
        n64Core={launch.platform === "n64" ? n64Core : undefined}
        onN64CoreChange={launch.platform === "n64" ? (core) => {
          setError(null);
          setPlayerReady(false);
          setN64Core(core);
        } : undefined}
        onRestart={restartPlayer}
        onTogglePause={togglePause}
        onError={handleError}
        gamepadName={snapshot.gamepadName}
        audio={audio}
        onAudioChange={changeAudio}
        onOpenControls={() => setControlsOpen(true)}
      />
    </main>
  );
}
