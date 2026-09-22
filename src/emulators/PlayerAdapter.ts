export type PlayerCapability = "save-state" | "netplay" | "controls" | "input";

export type PlayerRuntimeState =
  | "idle"
  | "initializing"
  | "loading"
  | "running"
  | "paused"
  | "destroying"
  | "destroyed"
  | "error";

export type Ps2InputControl =
  | "leftX" | "leftY" | "rightX" | "rightY"
  | "dpadUp" | "dpadDown" | "dpadLeft" | "dpadRight"
  | "select" | "start"
  | "square" | "triangle" | "circle" | "cross"
  | "l1" | "l2" | "l3" | "r1" | "r2" | "r3";

export type RomSource =
  | { kind: "file"; file: File; name: string }
  | { kind: "url"; url: string; name: string };

export interface InputValue {
  port: 0 | 1;
  control: Ps2InputControl;
  value: number;
}

export interface InputFrame {
  sequence: number;
  values: readonly InputValue[];
}

export interface PlayerEvent {
  state: PlayerRuntimeState;
  message?: string;
  code?: string;
}

export type PlayerEventListener = (event: PlayerEvent) => void;

export interface PlayerAdapter {
  readonly capabilities: ReadonlySet<PlayerCapability>;
  load(source: RomSource): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;
  setInput(frame: InputFrame): void;
  exportState(): Promise<ArrayBuffer>;
  importState(state: ArrayBuffer): Promise<void>;
  openNetplay(): Promise<void>;
  openControls(): Promise<void>;
  subscribe(listener: PlayerEventListener): () => void;
}

export class UnsupportedCapabilityError extends Error {
  readonly code = "UNSUPPORTED_CAPABILITY";

  constructor(capability: PlayerCapability) {
    super(`Este player não oferece o recurso: ${capability}.`);
    this.name = "UnsupportedCapabilityError";
  }
}

export const EMULATOR_JS_CAPABILITIES: ReadonlySet<PlayerCapability> = new Set([
  "save-state",
  "netplay",
  "controls",
]);

export const PLAY_PS2_CAPABILITIES: ReadonlySet<PlayerCapability> = new Set(["input"]);
