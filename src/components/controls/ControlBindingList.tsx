import { formatGamepad, formatKey } from "../../input/consoleMappings";
import type { ConsoleControlConfig, PlatformControlSettings } from "../../input/controlTypes";

interface ControlBindingListProps {
  config: ConsoleControlConfig;
  settings: PlatformControlSettings;
  listeningAction: string | null;
  listeningKind: "keyboard" | "gamepad" | null;
  onListen: (action: string, kind: "keyboard" | "gamepad") => void;
}

export function ControlBindingList({ config, settings, listeningAction, listeningKind, onListen }: ControlBindingListProps) {
  return (
    <div className="binding-list">
      <div className="binding-list__head"><span>Controle</span><span>Teclado</span><span>Gamepad</span></div>
      {config.controls.map((control) => {
        const listening = listeningAction === control.id;
        return (
          <div key={control.id} className={`binding-row${listening ? " is-listening" : ""}`}>
            <span className="binding-row__name"><i>{control.shortLabel}</i>{control.label}</span>
            <button type="button" onClick={() => onListen(control.id, "keyboard")}>
              {listening && listeningKind === "keyboard" ? "Pressione uma tecla…" : formatKey(settings.keyboard[control.id])}
            </button>
            <button type="button" onClick={() => onListen(control.id, "gamepad")}>
              {listening && listeningKind === "gamepad" ? "Pressione no controle…" : formatGamepad(settings.gamepad[control.id])}
            </button>
          </div>
        );
      })}
    </div>
  );
}
