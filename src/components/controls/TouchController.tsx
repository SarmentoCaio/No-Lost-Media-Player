import { useRef } from "react";
import { consoleMappings } from "../../input/consoleMappings";
import type { InputSnapshot, PlatformControlSettings, PlayablePlatform } from "../../input/controlTypes";
import type { InputManager } from "../../input/InputManager";
import { AnalogStick } from "./AnalogStick";
import { DPad } from "./DPad";

interface TouchControllerProps {
  platform: PlayablePlatform;
  settings: PlatformControlSettings;
  snapshot: InputSnapshot;
  manager: InputManager;
  disabled?: boolean;
}

export function TouchController({ platform, settings, snapshot, manager, disabled }: TouchControllerProps) {
  const config = consoleMappings[platform];
  const pointerActions = useRef(new Map<number, string>());
  const setInput = (action: string, value: number, source: string) => manager.setAction(action, value, source);

  return (
    <div className={`touch-controller touch-controller--${platform}${disabled ? " is-disabled" : ""}`} aria-label="Controles touch">
      {settings.mobile.dpad?.visible && (
        <div className="touch-control-element touch-control-element--dpad" style={touchStyle(settings.mobile.dpad)}>
          <DPad active={snapshot.values} onInput={setInput} disabled={disabled} />
        </div>
      )}
      {config.analogs.map((analog) => {
        const item = settings.mobile[analog.id];
        return item?.visible ? (
          <div key={analog.id} className="touch-control-element touch-control-element--analog" style={touchStyle(item)}>
            <AnalogStick definition={analog} active={snapshot.values} onInput={setInput} disabled={disabled} />
          </div>
        ) : null;
      })}
      {config.controls.filter((item) => item.kind === "button").map((control) => {
        const item = settings.mobile[control.id];
        if (!item?.visible) return null;
        return (
          <button
            key={control.id} type="button"
            className={`touch-control-element touch-action-button touch-action-button--${control.id}${snapshot.values[control.id] ? " is-active" : ""}`}
            style={touchStyle(item)}
            aria-label={control.label}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (disabled) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              pointerActions.current.set(event.pointerId, control.id);
              manager.setAction(control.id, 1, `touch:button:${event.pointerId}`);
            }}
            onPointerUp={(event) => {
              manager.setAction(control.id, 0, `touch:button:${event.pointerId}`);
              pointerActions.current.delete(event.pointerId);
            }}
            onPointerCancel={(event) => {
              manager.setAction(control.id, 0, `touch:button:${event.pointerId}`);
              pointerActions.current.delete(event.pointerId);
            }}
          >{control.shortLabel}</button>
        );
      })}
    </div>
  );
}

function touchStyle(item: { x: number; y: number; size: number; opacity: number }) {
  return {
    left: `${item.x}%`, top: `${item.y}%`,
    transform: `translate(-50%, -50%) scale(${item.size})`, opacity: item.opacity,
  };
}
