import { consoleMappings } from "../../input/consoleMappings";
import type { InputSnapshot, PlayablePlatform } from "../../input/controlTypes";
import { AnalogStick } from "./AnalogStick";
import { ControllerButton } from "./ControllerButton";
import { DPad } from "./DPad";

interface ControllerViewerProps {
  platform: PlayablePlatform;
  snapshot: InputSnapshot;
  listeningAction?: string | null;
  onSelectAction?: (action: string) => void;
}

export function ControllerViewer({ platform, snapshot, listeningAction, onSelectAction }: ControllerViewerProps) {
  const config = consoleMappings[platform];
  const retroLabel: Record<PlayablePlatform, string> = {
    nes: "8 BIT",
    snes: "16 BIT",
    gba: "ADVANCE",
    n64: "NINTENDO 64",
    ps1: "PlayStation",
    ps2: "DUALSHOCK 2",
  };
  return (
    <div className={`controller-viewer controller-viewer--${config.shape} controller-viewer--${platform}`}>
      <span className="controller-viewer__cable" aria-hidden="true" />
      <div className="controller-viewer__body" aria-label={`Controle ${config.name}`}>
        <span className="controller-viewer__retro-label" aria-hidden="true">{retroLabel[platform]}</span>
        <span className="controller-viewer__detail controller-viewer__detail--panel" aria-hidden="true" />
        <span className="controller-viewer__detail controller-viewer__detail--speaker" aria-hidden="true" />
        {(platform === "n64" || platform === "ps1" || platform === "ps2") && (
          <span className={`controller-viewer__brand controller-viewer__brand--${platform}`} aria-hidden="true">
            {platform === "n64" ? <><i>N</i><b>64</b></> : <><i>PS</i><b>{platform === "ps2" ? "ANALOG" : "POWER"}</b></>}
          </span>
        )}
        {platform === "gba" && (
          <span className="controller-viewer__screen" aria-hidden="true">
            <i>NO LOST</i><b>PLAYER</b>
          </span>
        )}
        <div className="controller-viewer__dpad">
          <DPad
            active={snapshot.values}
            onSelectAction={onSelectAction}
            listeningAction={listeningAction}
          />
        </div>
        {config.analogs.map((analog) => (
          <div key={analog.id} className="controller-viewer__analog" style={{ left: `${analog.visual.x}%`, top: `${analog.visual.y}%` }}>
            <AnalogStick
              definition={analog}
              active={snapshot.values}
              onSelectAction={onSelectAction}
              listeningAction={listeningAction}
              pressAction={(platform === "ps1" || platform === "ps2")
                ? analog.id === "left-stick" ? "l3" : "r3"
                : undefined}
            />
          </div>
        ))}
        {config.controls.filter((item) => item.kind === "button" && !["l3", "r3"].includes(item.id)).map((item) => (
          <ControllerButton
            key={item.id}
            label={item.shortLabel}
            x={item.visual.x}
            y={item.visual.y}
            active={(snapshot.values[item.id] ?? 0) > 0}
            listening={listeningAction === item.id}
            onClick={onSelectAction ? () => onSelectAction(item.id) : undefined}
            className={`controller-button--${item.id}`}
          />
        ))}
      </div>
    </div>
  );
}
