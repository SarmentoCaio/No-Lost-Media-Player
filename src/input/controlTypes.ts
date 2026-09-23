import type { Platform } from "../types/game";

export type PlayablePlatform = Platform;
export type ControlKind = "button" | "dpad" | "analog";

export interface GamepadButtonBinding {
  type: "button";
  index: number;
}

export interface GamepadAxisBinding {
  type: "axis";
  index: number;
  direction: -1 | 1;
}

export type GamepadBinding = GamepadButtonBinding | GamepadAxisBinding;

export interface ControlDefinition {
  id: string;
  label: string;
  shortLabel: string;
  coreIndex: number;
  kind: ControlKind;
  keyboard: string;
  gamepad: GamepadBinding;
  visual: { x: number; y: number };
}

export interface AnalogDefinition {
  id: "left-stick" | "right-stick";
  label: string;
  up: string;
  down: string;
  left: string;
  right: string;
  visual: { x: number; y: number };
}

export interface ConsoleControlConfig {
  platform: PlayablePlatform;
  name: string;
  shape: "rectangle" | "rounded" | "handheld" | "trident" | "dual-grip";
  controls: ControlDefinition[];
  analogs: AnalogDefinition[];
}

export interface MobileElementSettings {
  x: number;
  y: number;
  size: number;
  opacity: number;
  visible: boolean;
}

export interface PlatformControlSettings {
  keyboard: Record<string, string>;
  gamepad: Record<string, GamepadBinding>;
  mobile: Record<string, MobileElementSettings>;
}

export interface AudioSettings {
  volume: number;
  muted: boolean;
  previousVolume: number;
}

export type QuickActionId = "fastForward" | "save" | "load" | "pause" | "mute" | "fullscreen";

export type QuickActionSettings = Record<QuickActionId, string>;

export interface InputSnapshot {
  values: Readonly<Record<string, number>>;
  gamepadName: string | null;
}

export interface RawKeyboardInput {
  code: string;
  pressed: boolean;
  repeat?: boolean;
}
