import { useEffect, useState } from "react";
import { consoleMappings, playablePlatforms } from "../../input/consoleMappings";
import {
  loadControlSettings,
  resetControlSettings,
  resetQuickActionSettings,
  saveControlSettings,
  saveQuickActionSettings,
} from "../../input/settingsStorage";
import type {
  GamepadBinding,
  InputSnapshot,
  PlatformControlSettings,
  PlayablePlatform,
  QuickActionId,
  QuickActionSettings,
} from "../../input/controlTypes";
import type { InputManager } from "../../input/InputManager";
import { ControlBindingList } from "./ControlBindingList";
import { ControllerViewer } from "./ControllerViewer";
import { QuickActionList } from "./QuickActionList";

interface ControlsPanelProps {
  open: boolean;
  currentPlatform: PlayablePlatform;
  currentSettings: PlatformControlSettings;
  quickActionSettings: QuickActionSettings;
  snapshot: InputSnapshot;
  manager: InputManager;
  onCurrentSettingsChange: (settings: PlatformControlSettings) => void;
  onQuickActionSettingsChange: (settings: QuickActionSettings) => void;
  onClose: () => void;
  onEditTouch: () => void;
}

export function ControlsPanel({
  open,
  currentPlatform,
  currentSettings,
  quickActionSettings,
  snapshot,
  manager,
  onCurrentSettingsChange,
  onQuickActionSettingsChange,
  onClose,
  onEditTouch,
}: ControlsPanelProps) {
  const [platform, setPlatform] = useState<PlayablePlatform>(currentPlatform);
  const [section, setSection] = useState<"console" | "quick-actions">("console");
  const [settings, setSettings] = useState(currentSettings);
  const [quickSettings, setQuickSettings] = useState(quickActionSettings);
  const [listeningAction, setListeningAction] = useState<string | null>(null);
  const [listeningKind, setListeningKind] = useState<"keyboard" | "gamepad" | null>(null);
  const [listeningQuickAction, setListeningQuickAction] = useState<QuickActionId | null>(null);

  useEffect(() => {
    if (open) {
      setPlatform(currentPlatform);
      setSettings(currentSettings);
      setQuickSettings(quickActionSettings);
      setSection("console");
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

  useEffect(() => {
    if (!open || !listeningQuickAction) return;
    const capture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setListeningQuickAction(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const next = { ...quickSettings, [listeningQuickAction]: event.code };
      setQuickSettings(next);
      saveQuickActionSettings(next);
      onQuickActionSettingsChange(next);
      setListeningQuickAction(null);
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [listeningQuickAction, onQuickActionSettingsChange, open, quickSettings]);

  if (!open) return null;

  const selectPlatform = (nextPlatform: PlayablePlatform) => {
    manager.cancelGamepadCapture();
    setListeningAction(null);
    setListeningKind(null);
    setListeningQuickAction(null);
    setSection("console");
    setPlatform(nextPlatform);
    setSettings(nextPlatform === currentPlatform ? currentSettings : loadControlSettings(nextPlatform));
  };

  const selectQuickActions = () => {
    manager.cancelGamepadCapture();
    setListeningAction(null);
    setListeningKind(null);
    setListeningQuickAction(null);
    setSection("quick-actions");
  };

  const startListening = (action: string, kind: "keyboard" | "gamepad") => {
    setListeningQuickAction(null);
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

  const startListeningQuickAction = (action: QuickActionId) => {
    manager.cancelGamepadCapture();
    setListeningAction(null);
    setListeningKind(null);
    setListeningQuickAction(action);
  };

  const restore = () => {
    if (section === "quick-actions") {
      if (!window.confirm("Restaurar os atalhos padrão usados em todos os consoles?")) return;
      const restored = resetQuickActionSettings();
      setQuickSettings(restored);
      onQuickActionSettingsChange(restored);
      setListeningQuickAction(null);
      return;
    }
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
            <button type="button" key={item} className={section === "console" && item === platform ? "is-active" : ""} onClick={() => selectPlatform(item)}>
              {consoleMappings[item].name}
            </button>
          ))}
          <button type="button" className={section === "quick-actions" ? "is-active is-global" : "is-global"} onClick={selectQuickActions}>
            Ações rápidas
          </button>
        </nav>
        <div className="controls-panel__grid">
          {section === "console" ? (
            <div className="controls-visual-card">
              <ControllerViewer
                platform={platform}
                snapshot={shownSnapshot}
                listeningAction={listeningAction}
                onSelectAction={(action) => startListening(action, "keyboard")}
              />
              <p className="controls-visual-card__hint">
                Clique em um botão, em uma seta do direcional ou ao redor dos analógicos para mapear o teclado. Para gamepad, use a coluna “Gamepad”.
              </p>
              <div className="controls-live-status">
                <span className={snapshot.gamepadName ? "is-online" : ""} />
                {snapshot.gamepadName ?? "Nenhum gamepad detectado"}
              </div>
            </div>
          ) : (
            <div className="controls-visual-card controls-visual-card--quick-actions">
              <div className="quick-actions-visual" aria-hidden="true">
                <span>F5</span><span>SPACE</span><span>F9</span>
              </div>
              <div className="quick-actions-copy">
                <span>CONFIGURAÇÃO COMPARTILHADA</span>
                <h3>Um atalho, todos os consoles</h3>
                <p>Qualquer alteração feita aqui vale para todos os consoles, incluindo PlayStation 2.</p>
              </div>
            </div>
          )}
          <div className="controls-bindings-card">
            <div className="controls-bindings-card__title">
              <h3>{section === "console" ? "Mapeamento" : "Atalhos compartilhados"}</h3>
              <span>{section === "console" ? "Jogador 1" : "Todos os consoles"}</span>
            </div>
            {section === "console" ? (
              <ControlBindingList
                config={consoleMappings[platform]}
                settings={settings}
                listeningAction={listeningAction}
                listeningKind={listeningKind}
                onListen={startListening}
                quickActionSettings={quickSettings}
                listeningQuickAction={listeningQuickAction}
                onListenQuickAction={startListeningQuickAction}
              />
            ) : (
              <QuickActionList
                settings={quickSettings}
                listeningAction={listeningQuickAction}
                onListen={startListeningQuickAction}
              />
            )}
          </div>
        </div>
        <footer className="controls-panel__footer">
          <button type="button" className="secondary-button" onClick={restore}>
            {section === "console" ? "Restaurar padrão deste console" : "Restaurar atalhos padrão"}
          </button>
          {section === "console" && platform === currentPlatform && <button type="button" className="secondary-button" onClick={onEditTouch}>Editar controles touch</button>}
          <button type="button" className="toolbar-button toolbar-button--primary" onClick={onClose}>Concluído</button>
        </footer>
      </section>
    </div>
  );
}
