import { useRef } from "react";

interface DPadProps {
  active: Readonly<Record<string, number>>;
  actionIds?: { up: string; down: string; left: string; right: string };
  onInput?: (action: string, value: number, source: string) => void;
  disabled?: boolean;
}

const defaults = { up: "up", down: "down", left: "left", right: "right" };

export function DPad({ active, actionIds = defaults, onInput, disabled }: DPadProps) {
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
      role={onInput ? "group" : "img"}
      aria-label="Direcional"
    >
      <span className={`dpad__key dpad__key--up${active[actionIds.up] ? " is-active" : ""}`}>▲</span>
      <span className={`dpad__key dpad__key--right${active[actionIds.right] ? " is-active" : ""}`}>▶</span>
      <span className={`dpad__key dpad__key--down${active[actionIds.down] ? " is-active" : ""}`}>▼</span>
      <span className={`dpad__key dpad__key--left${active[actionIds.left] ? " is-active" : ""}`}>◀</span>
      <span className="dpad__center" />
    </div>
  );
}
