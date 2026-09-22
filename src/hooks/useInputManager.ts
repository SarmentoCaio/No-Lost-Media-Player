import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { EmulatorJSPlayerHandle } from "../components/EmulatorJSPlayer";
import { consoleMappings } from "../input/consoleMappings";
import { InputManager } from "../input/InputManager";
import type { InputSnapshot, PlatformControlSettings, PlayablePlatform, RawKeyboardInput } from "../input/controlTypes";

const emptySnapshot: InputSnapshot = { values: {}, gamepadName: null };

export function useInputManager(
  platform: PlayablePlatform,
  settings: PlatformControlSettings,
  emulatorRef: RefObject<EmulatorJSPlayerHandle | null>,
) {
  const managerRef = useRef<InputManager | null>(null);
  const [snapshot, setSnapshot] = useState<InputSnapshot>(emptySnapshot);

  if (!managerRef.current) {
    managerRef.current = new InputManager(
      consoleMappings[platform].controls,
      settings,
      (coreIndex, value) => emulatorRef.current?.setInput(coreIndex, value),
    );
  }

  useEffect(() => {
    const manager = managerRef.current!;
    manager.update(consoleMappings[platform].controls, settings);
    emulatorRef.current?.configureInput(Object.values(settings.keyboard));
  }, [emulatorRef, platform, settings]);

  useEffect(() => {
    const manager = managerRef.current!;
    const unsubscribe = manager.subscribe(setSnapshot);
    manager.start();
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], .touch-editor")) return;
      if (Object.values(settings.keyboard).includes(event.code)) {
        event.preventDefault();
        manager.handleKeyboard({ code: event.code, pressed: event.type === "keydown", repeat: event.repeat });
      }
    };
    const release = () => manager.releaseSourcePrefix("keyboard");
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keyup", onKey, { capture: true });
    window.addEventListener("blur", release);
    return () => {
      unsubscribe();
      manager.stop();
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("keyup", onKey, { capture: true });
      window.removeEventListener("blur", release);
    };
  }, [settings]);

  const handleIframeKeyboard = useCallback((input: RawKeyboardInput) => {
    managerRef.current?.handleKeyboard(input, "iframe-keyboard");
  }, []);

  return { manager: managerRef.current, snapshot, handleIframeKeyboard };
}
