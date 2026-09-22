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
  const dpadListening = config.controls.some((item) => item.kind === "dpad" && item.id === listeningAction);
  return (
    <div className={`controller-viewer controller-viewer--${config.shape} controller-viewer--${platform}`}>
      <div className="controller-viewer__body" aria-label={`Controle ${config.name}`}>
        <div className={`controller-viewer__dpad${dpadListening ? " is-listening" : ""}`}>
          <DPad active={snapshot.values} />
        </div>
        {config.analogs.map((analog) => (
          <div key={analog.id} className="controller-viewer__analog" style={{ left: `${analog.visual.x}%`, top: `${analog.visual.y}%` }}>
            <AnalogStick definition={analog} active={snapshot.values} />
          </div>
        ))}
        {config.controls.filter((item) => item.kind === "button").map((item) => (
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
