import {
  EMULATOR_JS_CAPABILITIES,
  type InputFrame,
  type PlayerAdapter,
  type PlayerEventListener,
  type RomSource,
} from "./PlayerAdapter";

type EmulatorCommand = "export-state" | "import-state" | "open-netplay" | "open-controls";

export interface EmulatorJsAdapterBridge {
  request(type: EmulatorCommand, state?: ArrayBuffer): Promise<ArrayBuffer | void>;
  post(type: "pause" | "resume" | "shutdown"): void;
  subscribe(listener: PlayerEventListener): () => void;
}

export class EmulatorJsAdapter implements PlayerAdapter {
  readonly capabilities = EMULATOR_JS_CAPABILITIES;

  constructor(private readonly bridge: EmulatorJsAdapterBridge) {}

  load(_source: RomSource): Promise<void> { return Promise.resolve(); }
  pause(): Promise<void> { this.bridge.post("pause"); return Promise.resolve(); }
  resume(): Promise<void> { this.bridge.post("resume"); return Promise.resolve(); }
  destroy(): Promise<void> { this.bridge.post("shutdown"); return Promise.resolve(); }
  setInput(_frame: InputFrame): void {}

  async exportState() {
    const state = await this.bridge.request("export-state");
    if (!(state instanceof ArrayBuffer)) throw new Error("O emulador não retornou um salvamento válido.");
    return state;
  }

  async importState(state: ArrayBuffer) { await this.bridge.request("import-state", state); }
  async openNetplay() { await this.bridge.request("open-netplay"); }
  async openControls() { await this.bridge.request("open-controls"); }
  subscribe(listener: PlayerEventListener) { return this.bridge.subscribe(listener); }
}
