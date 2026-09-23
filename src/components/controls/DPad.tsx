import { useRef } from "react";

interface DPadProps {
  active: Readonly<Record<string, number>>;
  actionIds?: { up: string; down: string; left: string; right: string };
  onInput?: (action: string, value: number, source: string) => void;
  onSelectAction?: (action: string) => void;
  listeningAction?: string | null;
  disabled?: boolean;
}

const defaults = { up: "up", down: "down", left: "left", right: "right" };

export function DPad({
  active,
  actionIds = defaults,
  onInput,
  onSelectAction,
  listeningAction,
  disabled,
}: DPadProps) {
  const pointerRef = useRef<number | null>(null);
  const pressedRef = useRef(new Set<string>());

  const update = (element: HTMLElement, clientX: number, clientY: number, source: string) => {
    const rect = element.getBoundingClientRect();
    const dx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const next = new Set<string>();
    if (dy < -0.22) next.add(actionIds.up);
    if (dy > 0.22) next.add(actionIds.down);
    if (dx < -0.22) next.add(actionIds.left);
    if (dx > 0.22) next.add(actionIds.right);
    for (const action of pressedRef.current) if (!next.has(action)) onInput?.(action, 0, source);
    for (const action of next) if (!pressedRef.current.has(action)) onInput?.(action, 1, source);
    pressedRef.current = next;
  };

  const release = (source: string) => {
    for (const action of pressedRef.current) onInput?.(action, 0, source);
    pressedRef.current.clear();
    pointerRef.current = null;
  };

  const key = (
    direction: keyof typeof actionIds,
    symbol: string,
    label: string,
  ) => {
    const action = actionIds[direction];
    return (
      <button
        type="button"
        className={`dpad__key dpad__key--${direction}${active[action] ? " is-active" : ""}${listeningAction === action ? " is-listening" : ""}${onSelectAction ? " is-mappable" : ""}`}
        onClick={onSelectAction ? (event) => {
          event.stopPropagation();
          onSelectAction(action);
        } : undefined}
        tabIndex={onSelectAction ? 0 : -1}
        aria-label={onSelectAction ? `Mapear ${label}` : label}
      >
        {symbol}
      </button>
    );
  };

  return (
    <div
      className="dpad"
      onPointerDown={(event) => {
        if (!onInput || disabled || pointerRef.current !== null) return;
        pointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.currentTarget, event.clientX, event.clientY, `touch:dpad:${event.pointerId}`);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointerRef.current) update(event.currentTarget, event.clientX, event.clientY, `touch:dpad:${event.pointerId}`);
      }}
      onPointerUp={(event) => { if (event.pointerId === pointerRef.current) release(`touch:dpad:${event.pointerId}`); }}
      onPointerCancel={(event) => { if (event.pointerId === pointerRef.current) release(`touch:dpad:${event.pointerId}`); }}
      role="group"
      aria-label="Direcional"
    >
      {key("up", "▲", "direcional para cima")}
      {key("right", "▶", "direcional para a direita")}
      {key("down", "▼", "direcional para baixo")}
      {key("left", "◀", "direcional para a esquerda")}
      <span className="dpad__center" />
    </div>
  );
}
