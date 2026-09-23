import { describe, expect, it } from "vitest";
import {
  PLAY_PROTOCOL,
  PLAY_PROTOCOL_VERSION,
  isPlayCommand,
  isPlayEvent,
} from "./playProtocol";

const sessionId = "123e4567-e89b-12d3-a456-426614174000";
const envelope = { protocol: PLAY_PROTOCOL, version: PLAY_PROTOCOL_VERSION, sessionId } as const;

describe("Play! bridge protocol guards", () => {
  it("accepts lifecycle and volume commands", () => {
    expect(isPlayCommand({ ...envelope, type: "pause", requestId: "request-1" }, sessionId)).toBe(true);
    expect(isPlayCommand({ ...envelope, type: "set-volume", volume: 0.5 }, sessionId)).toBe(true);
    expect(isPlayCommand({ ...envelope, type: "set-volume", volume: 2 }, sessionId)).toBe(false);
  });

  it("rejects commands from another session or protocol version", () => {
    const command = { ...envelope, type: "resume", requestId: "request-2" };
    expect(isPlayCommand(command, "another-session-id")).toBe(false);
    expect(isPlayCommand({ ...command, version: 2 }, sessionId)).toBe(false);
  });

  it("validates normalized input ranges and sequence values", () => {
    const valid = {
      ...envelope,
      type: "set-input",
      frame: {
        sequence: 0,
        values: [
          { port: 0, control: "cross", value: 1 },
          { port: 1, control: "leftX", value: -0.5 },
        ],
      },
    };
    expect(isPlayCommand(valid, sessionId)).toBe(true);
    expect(isPlayCommand({ ...valid, frame: { ...valid.frame, sequence: -1 } }, sessionId)).toBe(false);
    expect(isPlayCommand({
      ...valid,
      frame: { sequence: 1, values: [{ port: 0, control: "cross", value: 1.1 }] },
    }, sessionId)).toBe(false);
  });

  it("accepts HTTPS and same-origin ROM paths but rejects insecure URLs", () => {
    const command = { ...envelope, type: "load", requestId: "request-3" };
    expect(isPlayCommand({
      ...command,
      source: { kind: "url", url: "https://roms.example/game.iso", name: "game.iso" },
    }, sessionId)).toBe(true);
    expect(isPlayCommand({
      ...command,
      source: { kind: "url", url: "/api/rom?url=encoded", name: "game.iso" },
    }, sessionId)).toBe(true);
    expect(isPlayCommand({
      ...command,
      source: { kind: "url", url: "http://roms.example/game.iso", name: "game.iso" },
    }, sessionId)).toBe(false);
  });

  it("validates status and keyboard events", () => {
    expect(isPlayEvent({ ...envelope, type: "status", state: "running" }, sessionId)).toBe(true);
    expect(isPlayEvent({ ...envelope, type: "keyboard-input", code: "KeyX", pressed: true, repeat: false }, sessionId)).toBe(true);
    expect(isPlayEvent({ ...envelope, type: "status", state: "unknown" }, sessionId)).toBe(false);
    expect(isPlayEvent({ ...envelope, type: "destroyed", requestId: 42 }, sessionId)).toBe(false);
  });
});
