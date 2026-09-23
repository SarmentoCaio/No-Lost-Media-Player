import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { consoleMappings } from "../../input/consoleMappings";
import { resetControlSettings, saveControlSettings } from "../../input/settingsStorage";
import type { MobileElementSettings, PlatformControlSettings, PlayablePlatform } from "../../input/controlTypes";

interface TouchEditorProps {
  platform: PlayablePlatform;
  settings: PlatformControlSettings;
  onChange: (settings: PlatformControlSettings) => void;
  onClose: () => void;
}

export function TouchEditor({ platform, settings, onChange, onClose }: TouchEditorProps) {
  const [draft, setDraft] = useState(settings.mobile);
  const [selected, setSelected] = useState("dpad");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const config = consoleMappings[platform];

  useEffect(() => {
    setDraft(settings.mobile);
    setSelected("dpad");
  }, [platform, settings.mobile]);

  const update = (id: string, patch: Partial<MobileElementSettings>) => {
    setDraft((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const move = (event: ReactPointerEvent, id: string) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((event.clientX - rect.left - dragOffset.current.x) / rect.width) * 100));
    const y = Math.min(94, Math.max(6, ((event.clientY - rect.top - dragOffset.current.y) / rect.height) * 100));
    update(id, { x, y });
  };

  const beginDrag = (event: ReactPointerEvent, id: string) => {
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - (rect.left + rect.width / 2), y: event.clientY - (rect.top + rect.height / 2) };
    setSelected(id);
    element.setPointerCapture(event.pointerId);
    move(event, id);
  };

  const labels: Record<string, string> = { dpad: "Direcional", "left-stick": "Analógico esquerdo", "right-stick": "Analógico direito" };
  config.controls.filter((item) => item.kind === "button").forEach((item) => { labels[item.id] = item.label; });
  const elementIds = [
    "dpad",
    ...config.analogs.map((analog) => analog.id),
    ...config.controls.filter((item) => item.kind === "button").map((item) => item.id),
  ].filter((id, index, values) => values.indexOf(id) === index && draft[id]);
  const current = draft[selected] ?? { x: 50, y: 50, size: 1, opacity: 0.72, visible: true };

  const save = () => {
    const next = { ...settings, mobile: draft };
    saveControlSettings(platform, next);
    onChange(next);
    onClose();
  };

  const restore = () => {
    if (!window.confirm(`Restaurar o layout touch padrão de ${config.name}?`)) return;
    const restored = resetControlSettings(platform);
    setDraft(restored.mobile);
  };

  return (
    <div className="touch-editor" role="dialog" aria-modal="true" aria-label="Editar controles touch">
      <div className="touch-editor__toolbar">
        <div><strong>Editar controles · {config.name}</strong><span>Arraste os elementos dentro da área segura.</span></div>
        <label>Elemento
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {elementIds.map((id) => <option key={id} value={id}>{labels[id] ?? id}</option>)}
          </select>
        </label>
        <label>Tamanho<input type="range" min="50" max="180" value={current.size * 100} onChange={(event) => update(selected, { size: Number(event.target.value) / 100 })} /></label>
        <label>Opacidade<input type="range" min="20" max="100" value={current.opacity * 100} onChange={(event) => update(selected, { opacity: Number(event.target.value) / 100 })} /></label>
        <label className="touch-editor__visible"><input type="checkbox" checked={current.visible} onChange={(event) => update(selected, { visible: event.target.checked })} /> Visível</label>
        <button type="button" className="toolbar-button" onClick={restore}>Restaurar padrão</button>
        <button type="button" className="toolbar-button" onClick={onClose}>Cancelar</button>
        <button type="button" className="toolbar-button toolbar-button--primary" onClick={save}>Salvar</button>
      </div>
      <div className="touch-editor__surface" ref={surfaceRef}>
        <div className="touch-editor__safe-area"><span>ÁREA SEGURA</span></div>
        {Object.entries(draft).map(([id, item]) => (
          <button
            type="button" key={id}
            className={`touch-editor__item${selected === id ? " is-selected" : ""}${item.visible ? "" : " is-hidden"}`}
            style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) scale(${item.size})`, opacity: item.opacity }}
            onPointerDown={(event) => beginDrag(event, id)}
            onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event, id); }}
          >
            {labels[id] ?? id}
          </button>
        ))}
      </div>
    </div>
  );
}
