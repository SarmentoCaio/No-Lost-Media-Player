import {
  PLAY_PS2_CAPABILITIES,
  UnsupportedCapabilityError,
  type InputFrame,
  type PlayerAdapter,
  type PlayerEventListener,
  type RomSource,
} from "./PlayerAdapter";
import { isPlayEvent, makeEnvelope, type PlayCommand } from "./playProtocol";

interface PendingRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: number;
}

export class PlayPs2Adapter implements PlayerAdapter {
  readonly capabilities = PLAY_PS2_CAPABILITIES;
  readonly sessionId = crypto.randomUUID();

  private readonly listeners = new Set<PlayerEventListener>();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly readyPromise: Promise<void>;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private bridgeReady = false;
  private destroyed = false;
  private handshakeTimeout: number;

  constructor(private readonly iframe: HTMLIFrameElement) {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.handshakeTimeout = window.setTimeout(() => {
      const error = new Error("O iframe Play! não concluiu o handshake.");
      this.rejectReady?.(error);
      this.rejectReady = null;
      this.resolveReady = null;
    }, 10000);
    window.addEventListener("message", this.handleMessage);
    this.iframe.src = `/emulator/ps2/index.html#${encodeURIComponent(this.sessionId)}`;
  }

  private readonly handleMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== this.iframe.contentWindow || event.origin !== window.location.origin) return;
    if (!isPlayEvent(event.data, this.sessionId)) return;
    const message = event.data;

    if (message.type === "bridge-ready") {
      window.clearTimeout(this.handshakeTimeout);
      this.bridgeReady = true;
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      return;
    }
    if (message.type === "status") {
      this.listeners.forEach((listener) => listener({ state: message.state, message: message.message }));
      return;
    }
    if (message.type === "fatal-error") {
      window.clearTimeout(this.handshakeTimeout);
      const error = new Error(message.message);
      this.rejectReady?.(error);
      this.listeners.forEach((listener) => listener({ state: "error", message: message.message, code: message.code }));
      return;
    }
    if (message.type === "destroyed") {
      this.finishDestroy(message.requestId);
      return;
    }

    const request = this.pending.get(message.requestId);
    if (!request) return;
    window.clearTimeout(request.timeout);
    this.pending.delete(message.requestId);
    if (message.type === "command-error") request.reject(new Error(message.message));
    else request.resolve();
  };

  private async request(type: "load" | "pause" | "resume" | "destroy", source?: RomSource): Promise<void> {
    if (this.destroyed && type !== "destroy") throw new Error("A instância Play! já foi encerrada.");
    await this.readyPromise;
    const target = this.iframe.contentWindow;
    if (!target) throw new Error("O iframe Play! não está disponível.");

    const requestId = crypto.randomUUID();
    const command = {
      ...makeEnvelope(this.sessionId),
      type,
      requestId,
      ...(source ? { source } : {}),
    } as PlayCommand;
    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(type === "destroy"
          ? "O Play! não concluiu o encerramento em cinco segundos."
          : "O Play! demorou demais para responder."));
      }, type === "destroy" ? 5000 : type === "load" ? 120000 : 10000);
      this.pending.set(requestId, { resolve, reject, timeout });
      target.postMessage(command, window.location.origin);
    });
  }

  private finishDestroy(requestId?: string) {
    if (requestId) {
      const request = this.pending.get(requestId);
      if (request) {
        window.clearTimeout(request.timeout);
        request.resolve();
        this.pending.delete(requestId);
      }
    }
    this.destroyed = true;
    this.listeners.forEach((listener) => listener({ state: "destroyed" }));
  }

  load(source: RomSource) { return this.request("load", source); }
  pause() { return this.request("pause"); }
  resume() { return this.request("resume"); }

  async destroy() {
    if (this.destroyed) return;
    if (!this.bridgeReady) {
      window.clearTimeout(this.handshakeTimeout);
      this.destroyed = true;
      const error = new Error("A instância Play! foi encerrada antes do handshake.");
      this.rejectReady?.(error);
      this.rejectReady = null;
      this.resolveReady = null;
      window.removeEventListener("message", this.handleMessage);
      this.iframe.src = "about:blank";
      return;
    }
    try {
      await this.request("destroy");
    } finally {
      window.clearTimeout(this.handshakeTimeout);
      this.destroyed = true;
      window.removeEventListener("message", this.handleMessage);
      for (const request of this.pending.values()) {
        window.clearTimeout(request.timeout);
        request.reject(new Error("A instância Play! foi encerrada."));
      }
      this.pending.clear();
      this.iframe.src = "about:blank";
    }
  }

  setInput(frame: InputFrame) {
    if (this.destroyed || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage(
      { ...makeEnvelope(this.sessionId), type: "set-input", frame } satisfies PlayCommand,
      window.location.origin,
    );
  }

  exportState(): Promise<ArrayBuffer> { return Promise.reject(new UnsupportedCapabilityError("save-state")); }
  importState(_state: ArrayBuffer): Promise<void> { return Promise.reject(new UnsupportedCapabilityError("save-state")); }
  openNetplay(): Promise<void> { return Promise.reject(new UnsupportedCapabilityError("netplay")); }
  openControls(): Promise<void> { return Promise.reject(new UnsupportedCapabilityError("controls")); }

  subscribe(listener: PlayerEventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
