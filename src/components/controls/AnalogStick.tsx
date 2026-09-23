import { useRef } from "react";
import type { AnalogDefinition } from "../../input/controlTypes";

interface AnalogStickProps {
  definition: AnalogDefinition;
  active: Readonly<Record<string, number>>;
  onInput?: (action: string, value: number, source: string) => void;
  onSelectAction?: (action: string) => void;
  listeningAction?: string | null;
  pressAction?: string;
  disabled?: boolean;
}

export function AnalogStick({
  definition,
  active,
  onInput,
  onSelectAction,
  listeningAction,
  pressAction,
  disabled,
}: AnalogStickProps) {
  const pointerRef = useRef<number | null>(null);
  const sourceRef = useRef("");
  const x = (active[definition.right] ?? 0) - (active[definition.left] ?? 0);
  const y = (active[definition.down] ?? 0) - (active[definition.up] ?? 0);

  const send = (element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    let nextX = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let nextY = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const length = Math.hypot(nextX, nextY);
    if (length > 1) { nextX /= length; nextY /= length; }
    const deadZone = 0.12;
    if (Math.abs(nextX) < deadZone) nextX = 0;
    if (Math.abs(nextY) < deadZone) nextY = 0;
    const source = sourceRef.current;
    onInput?.(definition.left, Math.max(0, -nextX), source);
    onInput?.(definition.right, Math.max(0, nextX), source);
    onInput?.(definition.up, Math.max(0, -nextY), source);
    onInput?.(definition.down, Math.max(0, nextY), source);
  };

  const release = () => {
    if (!sourceRef.current) return;
    for (const action of [definition.left, definition.right, definition.up, definition.down]) onInput?.(action, 0, sourceRef.current);
    pointerRef.current = null;
    sourceRef.current = "";
  };

  return (
    <div
      className={`analog-stick${onSelectAction ? " analog-stick--mappable" : ""}`}
      onPointerDown={(event) => {
        if (!onInput || disabled || pointerRef.current !== null) return;
        pointerRef.current = event.pointerId;
        sourceRef.current = `touch:${definition.id}:${event.pointerId}`;
        event.currentTarget.setPointerCapture(event.pointerId);
        send(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointerRef.current) send(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { if (event.pointerId === pointerRef.current) release(); }}
      onPointerCancel={(event) => { if (event.pointerId === pointerRef.current) release(); }}
      role={onInput ? "slider" : onSelectAction ? "group" : "img"}
      aria-label={definition.label}
      aria-valuetext={`X ${x.toFixed(2)}, Y ${y.toFixed(2)}`}
    >
      <span className="analog-stick__gate" />
      <span className="analog-stick__knob" style={{ transform: `translate(calc(-50% + ${x * 24}px), calc(-50% + ${y * 24}px))` }} />
      {onSelectAction && (
        <>
          {([
            ["up", definition.up, "↑", "cima"],
            ["right", definition.right, "→", "direita"],
            ["down", definition.down, "↓", "baixo"],
            ["left", definition.left, "←", "esquerda"],
          ] as const).map(([direction, action, symbol, label]) => (
            <button
              type="button"
              key={direction}
              className={`analog-stick__map-zone analog-stick__map-zone--${direction}${listeningAction === action ? " is-listening" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectAction(action);
              }}
              aria-label={`Mapear ${definition.label} para ${label}`}
              title={`Mapear ${label}`}
            >
              {symbol}
            </button>
          ))}
          {pressAction && (
            <button
              type="button"
              className={`analog-stick__map-zone analog-stick__map-zone--press${listeningAction === pressAction ? " is-listening" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectAction(pressAction);
              }}
              aria-label={`Mapear clique de ${definition.label}`}
              title={`Mapear ${pressAction.toUpperCase()}`}
            >
              {pressAction.toUpperCase()}
            </button>
          )}
        </>
      )}
    </div>
  );
}
