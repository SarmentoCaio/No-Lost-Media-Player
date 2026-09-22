import type { InputFrame, PlayerRuntimeState, Ps2InputControl, RomSource } from "./PlayerAdapter";

export const PLAY_PROTOCOL = "no-lost-play" as const;
export const PLAY_PROTOCOL_VERSION = 1 as const;

interface Envelope {
  protocol: typeof PLAY_PROTOCOL;
  version: typeof PLAY_PROTOCOL_VERSION;
  sessionId: string;
}

interface RequestEnvelope extends Envelope {
  requestId: string;
}

export type PlayCommand =
  | (RequestEnvelope & { type: "load"; source: RomSource })
  | (RequestEnvelope & { type: "pause" })
  | (RequestEnvelope & { type: "resume" })
  | (RequestEnvelope & { type: "destroy" })
  | (Envelope & { type: "set-input"; frame: InputFrame });

export type PlayEvent =
  | (Envelope & { type: "bridge-ready" })
  | (Envelope & { type: "status"; state: PlayerRuntimeState; message?: string })
  | (RequestEnvelope & { type: "command-result" })
  | (RequestEnvelope & { type: "command-error"; code: string; message: string })
  | (Envelope & { type: "fatal-error"; code: string; message: string })
  | (Envelope & { type: "destroyed"; requestId?: string });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEnvelope(value: unknown): value is Record<string, unknown> & Envelope {
  if (!isRecord(value)) return false;
  return value.protocol === PLAY_PROTOCOL
    && value.version === PLAY_PROTOCOL_VERSION
    && typeof value.sessionId === "string"
    && value.sessionId.length >= 16;
}

function isRequest(value: Record<string, unknown>): boolean {
  return typeof value.requestId === "string" && value.requestId.length >= 8;
}

function isRomSource(value: unknown): value is RomSource {
  if (!isRecord(value) || typeof value.name !== "string" || value.name.length === 0) return false;
  if (value.kind === "file") return value.file instanceof File;
  return value.kind === "url" && typeof value.url === "string" && /^https:\/\//i.test(value.url);
}

function isInputFrame(value: unknown): value is InputFrame {
  if (!isRecord(value) || !Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0 || !Array.isArray(value.values)) return false;
  return value.values.every((item) => isRecord(item)
    && (item.port === 0 || item.port === 1)
    && isPs2Control(item.control)
    && typeof item.value === "number"
    && Number.isFinite(item.value)
    && (AXIS_CONTROLS.has(item.control) ? item.value >= -1 && item.value <= 1 : item.value >= 0 && item.value <= 1));
}

const PS2_CONTROLS: readonly Ps2InputControl[] = [
  "leftX", "leftY", "rightX", "rightY",
  "dpadUp", "dpadDown", "dpadLeft", "dpadRight",
  "select", "start", "square", "triangle", "circle", "cross",
  "l1", "l2", "l3", "r1", "r2", "r3",
];
const AXIS_CONTROLS = new Set<Ps2InputControl>(["leftX", "leftY", "rightX", "rightY"]);
const PLAYER_STATES = new Set<PlayerRuntimeState>([
  "idle", "initializing", "loading", "running", "paused", "destroying", "destroyed", "error",
]);

function isPs2Control(value: unknown): value is Ps2InputControl {
  return typeof value === "string" && (PS2_CONTROLS as readonly string[]).includes(value);
}

export function isPlayCommand(value: unknown, sessionId: string): value is PlayCommand {
  if (!isEnvelope(value) || value.sessionId !== sessionId || typeof value.type !== "string") return false;
  if (value.type === "set-input") return isInputFrame(value.frame);
  if (!isRequest(value)) return false;
  if (value.type === "load") return isRomSource(value.source);
  return value.type === "pause" || value.type === "resume" || value.type === "destroy";
}

export function isPlayEvent(value: unknown, sessionId: string): value is PlayEvent {
  if (!isEnvelope(value) || value.sessionId !== sessionId || typeof value.type !== "string") return false;
  if (value.type === "bridge-ready") return true;
  if (value.type === "destroyed") return value.requestId === undefined || typeof value.requestId === "string";
  if (value.type === "status") return typeof value.state === "string" && PLAYER_STATES.has(value.state as PlayerRuntimeState)
    && (value.message === undefined || typeof value.message === "string");
  if (value.type === "fatal-error") {
    return typeof value.code === "string" && typeof value.message === "string";
  }
  if ((value.type === "command-result" || value.type === "command-error") && isRequest(value)) {
    return value.type === "command-result"
      || (typeof value.code === "string" && typeof value.message === "string");
  }
  return false;
}

export function makeEnvelope(sessionId: string): Envelope {
  return { protocol: PLAY_PROTOCOL, version: PLAY_PROTOCOL_VERSION, sessionId };
}
