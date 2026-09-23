export type PlayerCapability = "save-state" | "netplay" | "controls" | "input" | "volume";

export type PlayerRuntimeState =
  | "idle" | "initializing" | "loading" | "running" | "paused"
  | "destroying" | "destroyed" | "error";

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

export const PLAY_PS2_CAPABILITIES: ReadonlySet<PlayerCapability> = new Set(["input", "controls", "volume"]);

