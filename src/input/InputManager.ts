import type { ControlDefinition, GamepadBinding, InputSnapshot, PlatformControlSettings, RawKeyboardInput } from "./controlTypes";

type InputListener = (snapshot: InputSnapshot) => void;
type CoreWriter = (coreIndex: number, value: number) => void;

export class InputManager {
  private controls: ControlDefinition[];
  private settings: PlatformControlSettings;
  private readonly writeCore: CoreWriter;
  private readonly listeners = new Set<InputListener>();
  private readonly sources = new Map<string, Map<string, number>>();
  private values: Record<string, number> = {};
  private gamepadName: string | null = null;
  private animationFrame = 0;
  private enabled = true;
  private capture: ((binding: GamepadBinding) => void) | null = null;
  private capturedAxis = false;

  constructor(controls: ControlDefinition[], settings: PlatformControlSettings, writeCore: CoreWriter) {
    this.controls = controls;
    this.settings = settings;
    this.writeCore = writeCore;
  }

  update(controls: ControlDefinition[], settings: PlatformControlSettings) {
    this.releaseAll();
    this.controls = controls;
    this.settings = settings;
  }

  start() {
    const tick = () => {
      this.pollGamepad();
      this.animationFrame = requestAnimationFrame(tick);
    };
    if (!this.animationFrame) this.animationFrame = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.releaseAll();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  subscribe(listener: InputListener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  handleKeyboard(input: RawKeyboardInput, source = "keyboard") {
    if (!this.enabled || input.repeat) return;
    const action = Object.entries(this.settings.keyboard).find(([, code]) => code === input.code)?.[0];
    if (!action) return;
    this.setAction(action, input.pressed ? 1 : 0, `${source}:${input.code}`);
  }

  setAction(action: string, value: number, source: string) {
    if (!this.enabled && value !== 0) return;
    let actionSources = this.sources.get(action);
    if (!actionSources) {
      actionSources = new Map();
      this.sources.set(action, actionSources);
    }
    if (Math.abs(value) < 0.001) actionSources.delete(source);
    else actionSources.set(source, Math.min(1, Math.max(0, value)));

    let effective = 0;
    actionSources.forEach((candidate) => { effective = Math.max(effective, candidate); });
    if (this.values[action] === effective) return;
    this.values = { ...this.values, [action]: effective };
    const definition = this.controls.find((item) => item.id === action);
    if (definition) this.writeCore(definition.coreIndex, effective);
    this.emit();
  }

  releaseSourcePrefix(prefix: string) {
    for (const [action, actionSources] of this.sources) {
      for (const source of [...actionSources.keys()]) {
        if (source.startsWith(prefix)) this.setAction(action, 0, source);
      }
    }
  }

  releaseAll() {
    for (const definition of this.controls) {
      if ((this.values[definition.id] ?? 0) !== 0) this.writeCore(definition.coreIndex, 0);
    }
    this.sources.clear();
    this.values = {};
    this.emit();
  }

  captureNextGamepad(callback: (binding: GamepadBinding) => void) {
    this.capture = callback;
    this.capturedAxis = false;
  }

  cancelGamepadCapture() {
    this.capture = null;
  }

  private pollGamepad() {
    const gamepad = Array.from(navigator.getGamepads?.() ?? []).find((item) => item?.connected) ?? null;
    const nextName = gamepad?.id ?? null;
    if (nextName !== this.gamepadName) {
      this.gamepadName = nextName;
      this.emit();
    }
    if (!gamepad || !this.enabled) {
      this.releaseSourcePrefix("gamepad:");
      return;
    }

    if (this.capture) {
      const buttonIndex = gamepad.buttons.findIndex((item) => item.value > 0.65);
      if (buttonIndex >= 0) {
        const callback = this.capture;
        this.capture = null;
        callback({ type: "button", index: buttonIndex });
        return;
      }
      const axisIndex = gamepad.axes.findIndex((value) => Math.abs(value) > 0.7);
      if (axisIndex >= 0 && !this.capturedAxis) {
        this.capturedAxis = true;
        const callback = this.capture;
        this.capture = null;
        callback({ type: "axis", index: axisIndex, direction: gamepad.axes[axisIndex] > 0 ? 1 : -1 });
        return;
      }
    }

    for (const control of this.controls) {
      const binding = this.settings.gamepad[control.id];
      if (!binding) continue;
      let value = 0;
      if (binding.type === "button") value = gamepad.buttons[binding.index]?.value ?? 0;
      else {
        const raw = (gamepad.axes[binding.index] ?? 0) * binding.direction;
        const deadZone = 0.18;
        value = raw <= deadZone ? 0 : Math.min(1, (raw - deadZone) / (1 - deadZone));
      }
      if (control.kind !== "analog") value = value >= 0.5 ? 1 : 0;
      this.setAction(control.id, value, `gamepad:${control.id}`);
    }
  }

  private snapshot(): InputSnapshot {
    return { values: this.values, gamepadName: this.gamepadName };
  }

  private emit() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
