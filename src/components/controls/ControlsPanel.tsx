import { useEffect, useState } from "react";
import { consoleMappings, playablePlatforms } from "../../input/consoleMappings";
import { loadControlSettings, resetControlSettings, saveControlSettings } from "../../input/settingsStorage";
import type { GamepadBinding, InputSnapshot, PlatformControlSettings, PlayablePlatform } from "../../input/controlTypes";
import type { InputManager } from "../../input/InputManager";
import { ControlBindingList } from "./ControlBindingList";
import { ControllerViewer } from "./ControllerViewer";

interface ControlsPanelProps {
  open: boolean;
  currentPlatform: PlayablePlatform;
  currentSettings: PlatformControlSettings;
  snapshot: InputSnapshot;
  manager: InputManager;
  onCurrentSettingsChange: (settings: PlatformControlSettings) => void;
  onClose: () => void;
  onEditTouch: () => void;
}

export function ControlsPanel({
  open, currentPlatform, currentSettings, snapshot, manager, onCurrentSettingsChange, onClose, onEditTouch,
}: ControlsPanelProps) {
  const [platform, setPlatform] = useState<PlayablePlatform>(currentPlatform);
  const [settings, setSettings] = useState(currentSettings);
  const [listeningAction, setListeningAction] = useState<string | null>(null);
  const [listeningKind, setListeningKind] = useState<"keyboard" | "gamepad" | null>(null);

  useEffect(() => {
    if (open) {
      setPlatform(currentPlatform);
      setSettings(currentSettings);
    }
  }, [currentPlatform, currentSettings, open]);

  useEffect(() => {
    if (!open || listeningKind !== "keyboard" || !listeningAction) return;
    const capture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setListeningAction(null);
        setListeningKind(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const next = { ...settings, keyboard: { ...settings.keyboard, [listeningAction]: event.code } };
      setSettings(next);
      saveControlSettings(platform, next);
      if (platform === currentPlatform) onCurrentSettingsChange(next);
      setListeningAction(null);
      setListeningKind(null);
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [currentPlatform, listeningAction, listeningKind, onCurrentSettingsChange, open, platform, settings]);

  if (!open) return null;

  const selectPlatform = (nextPlatform: PlayablePlatform) => {
    manager.cancelGamepadCapture();
    setListeningAction(null);
    setListeningKind(null);
    setPlatform(nextPlatform);
    setSettings(nextPlatform === currentPlatform ? currentSettings : loadControlSettings(nextPlatform));
  };

  const startListening = (action: string, kind: "keyboard" | "gamepad") => {
    setListeningAction(action);
    setListeningKind(kind);
    if (kind === "gamepad") {
      manager.captureNextGamepad((binding: GamepadBinding) => {
        setSettings((current) => {
          const next = { ...current, gamepad: { ...current.gamepad, [action]: binding } };
          saveControlSettings(platform, next);
          if (platform === currentPlatform) onCurrentSettingsChange(next);
          return next;
        });
        setListeningAction(null);
        setListeningKind(null);
      });
    } else manager.cancelGamepadCapture();
  };

  const restore = () => {
    if (!window.confirm(`Restaurar apenas os controles padrão de ${consoleMappings[platform].name}?`)) return;
    const restored = resetControlSettings(platform);
    setSettings(restored);
    if (platform === currentPlatform) onCurrentSettingsChange(restored);
    setListeningAction(null);
    setListeningKind(null);
  };

  const shownSnapshot = platform === currentPlatform ? snapshot : { values: {}, gamepadName: snapshot.gamepadName };

  return (
    <div className="controls-modal" role="dialog" aria-modal="true" aria-label="Configurar controles">
      <button className="controls-modal__backdrop" type="button" onClick={onClose} aria-label="Fechar controles" />
      <section className="controls-panel">
        <header className="controls-panel__header">
          <div><span>INPUT LAB</span><h2>Controles do console</h2><p>Teclado, gamepad e visualização usam o mesmo estado de entrada.</p></div>
          <button type="button" className="controls-panel__close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <nav className="controls-platforms" aria-label="Console">
          {playablePlatforms.map((item) => (
            <button type="button" key={item} className={item === platform ? "is-active" : ""} onClick={() => selectPlatform(item)}>
              {consoleMappings[item].name}
            </button>
          ))}
        </nav>
        <div className="controls-panel__grid">
          <div className="controls-visual-card">
            <ControllerViewer
              platform={platform}
              snapshot={shownSnapshot}
              listeningAction={listeningAction}
              onSelectAction={(action) => startListening(action, "keyboard")}
            />
            <div className="controls-live-status">
              <span className={snapshot.gamepadName ? "is-online" : ""} />
              {snapshot.gamepadName ?? "Nenhum gamepad detectado"}
            </div>
          </div>
          <div className="controls-bindings-card">
            <div className="controls-bindings-card__title"><h3>Mapeamento</h3><span>Jogador 1</span></div>
            <ControlBindingList
              config={consoleMappings[platform]}
              settings={settings}
              listeningAction={listeningAction}
              listeningKind={listeningKind}
              onListen={startListening}
            />
          </div>
        </div>
        <footer className="controls-panel__footer">
          <button type="button" className="secondary-button" onClick={restore}>Restaurar padrão deste console</button>
          {platform === currentPlatform && <button type="button" className="secondary-button" onClick={onEditTouch}>Editar controles touch</button>}
          <button type="button" className="toolbar-button toolbar-button--primary" onClick={onClose}>Concluído</button>
        </footer>
      </section>
    </div>
  );
}
