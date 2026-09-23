import type { Ps2InputControl, RomSource } from "./emulators/PlayerAdapter";
import { isPlayCommand, makeEnvelope, type PlayCommand, type PlayEvent } from "./emulators/playProtocol";
import { FileDiscDevice, RangeDiscDevice, type DiscImageDevice } from "./emulators/ps2DiscDevice";

interface RuntimePointer { version: string; runtimePath: string; }
interface RuntimeManifest { version: string; emscripten: string; threadPoolSize: number; }
interface PlayModule {
  HEAPU8: Uint8Array;
  discImageDevice: DiscImageDevice;
  init(selector: string): boolean;
  loadDisc(name: string): void;
  pause(): void;
  resume(): void;
  setInput(port: 0 | 1, control: Ps2InputControl, value: number): void;
  prepareDestroy(): void;
  isReadyToDestroy(): boolean;
  destroy(): boolean;
  getRuntimeState(): string;
  getRuntimeVersion(): string;
  getLastError(): string;
}
type PlayFactory = (options: {
  canvas: HTMLCanvasElement;
  locateFile: (path: string) => string;
  mainScriptUrlOrBlob: string;
  print: (message: string) => void;
  printErr: (message: string) => void;
}) => Promise<PlayModule>;

const sessionId = decodeURIComponent(window.location.hash.slice(1));
const canvas = document.querySelector<HTMLCanvasElement>("#outputCanvas")!;
const fatal = document.querySelector<HTMLDivElement>("#fatal")!;
const activation = document.querySelector<HTMLDivElement>("#activate")!;
let playModule: PlayModule | null = null;
let discDevice: DiscImageDevice | null = null;
let state: "idle" | "initializing" | "loading" | "running" | "paused" | "destroying" | "destroyed" | "error" = "idle";
let commandQueue = Promise.resolve();
let lastExternalInputSequence = -1;
let pausedByVisibility = false;
let desiredVolume = 0.8;
const inputValues = new Map<string, number>();
const masterVolumeGains = new Set<GainNode>();

type PlayEventPayload = PlayEvent extends infer Event
  ? Event extends PlayEvent ? Omit<Event, "protocol" | "version" | "sessionId"> : never
  : never;
type QueuedCommand = Exclude<PlayCommand, { type: "set-input" | "set-volume" }>;

function send(message: PlayEventPayload) {
  window.parent.postMessage({ ...makeEnvelope(sessionId), ...message }, window.location.origin);
}
function setStatus(nextState: typeof state, message?: string) {
  state = nextState;
  send({ type: "status", state: nextState, ...(message ? { message } : {}) });
}
function showFatal(code: string, message: string) {
  state = "error";
  canvas.style.display = "none";
  activation.style.display = "none";
  fatal.style.display = "grid";
  fatal.replaceChildren();
  const wrapper = document.createElement("div");
  const title = document.createElement("strong");
  const detail = document.createElement("span");
  title.textContent = "Falha ao iniciar o Play!";
  detail.textContent = message;
  wrapper.append(title, detail);
  fatal.append(wrapper);
  send({ type: "fatal-error", code, message });
}

function applyMasterVolume(volume: number) {
  desiredVolume = Math.min(1, Math.max(0, Number(volume) || 0));
  masterVolumeGains.forEach((gain) => {
    gain.gain.cancelScheduledValues(gain.context.currentTime);
    gain.gain.setValueAtTime(desiredVolume, gain.context.currentTime);
  });
}

function installMasterVolume() {
  const prototype = AudioNode.prototype as AudioNode & { __noLostPs2VolumeInstalled?: boolean };
  if (prototype.__noLostPs2VolumeInstalled) return;
  const originalConnectNode = AudioNode.prototype.connect as unknown as (
    this: AudioNode,
    destination: AudioNode,
    output?: number,
    input?: number,
  ) => AudioNode;
  const originalConnectParam = AudioNode.prototype.connect as unknown as (
    this: AudioNode,
    destination: AudioParam,
    output?: number,
  ) => void;
  Object.defineProperty(prototype, "__noLostPs2VolumeInstalled", { value: true });
  const gainsByContext = new WeakMap<BaseAudioContext, GainNode>();
  AudioNode.prototype.connect = function(
    this: AudioNode,
    destination: AudioNode | AudioParam,
    output?: number,
    input?: number,
  ) {
    if (destination === this.context.destination) {
      let master = gainsByContext.get(this.context);
      if (!master) {
        const nextMaster = this.context.createGain();
        nextMaster.gain.value = desiredVolume;
        originalConnectNode.call(nextMaster, this.context.destination);
        gainsByContext.set(this.context, nextMaster);
        masterVolumeGains.add(nextMaster);
        master = nextMaster;
      }
      return originalConnectNode.call(this, master, output, input);
    }
    if (destination instanceof AudioNode) {
      return originalConnectNode.call(this, destination, output, input);
    }
    return originalConnectParam.call(this, destination, output);
  } as typeof AudioNode.prototype.connect;
}
installMasterVolume();

async function loadRuntimePointer(): Promise<RuntimePointer> {
  const response = await fetch("/emulator/ps2/play-runtime.json", { cache: "no-store" });
  if (!response.ok) throw new Error("O runtime Play! ainda não foi publicado nesta implantação.");
  const candidate = await response.json() as Partial<RuntimePointer>;
  if (typeof candidate.version !== "string" || typeof candidate.runtimePath !== "string") {
    throw new Error("O ponteiro do runtime Play! está incompleto.");
  }
  const runtimeUrl = new URL(candidate.runtimePath, window.location.origin);
  if (runtimeUrl.origin !== window.location.origin) throw new Error("O runtime Play! precisa ser same-origin.");
  const pointer = { version: candidate.version, runtimePath: runtimeUrl.pathname.replace(/\/?$/, "/") };
  const manifestResponse = await fetch(`${pointer.runtimePath}runtime-manifest.json`, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("O manifesto do runtime Play! não está disponível.");
  const manifest = await manifestResponse.json() as Partial<RuntimeManifest>;
  if (manifest.version !== pointer.version || manifest.emscripten !== "4.0.1" || manifest.threadPoolSize !== 2) {
    throw new Error("A versão ou configuração do runtime Play! não corresponde ao host.");
  }
  return pointer;
}

function assertPlatformSupport() {
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    throw new Error("Play! requer isolamento COOP/COEP e SharedArrayBuffer.");
  }
  if (!canvas.getContext("webgl2")) throw new Error("Play! requer WebGL 2.");
}

async function createDiscDevice(source: RomSource) {
  if (source.kind === "file") return new FileDiscDevice(source.file);
  const sourceUrl = new URL(source.url, window.location.origin);
  const allowedOrigins = (import.meta.env.VITE_PS2_ROM_ORIGINS ?? "")
    .split(",").map((origin: string) => origin.trim()).filter(Boolean);
  const originsAreRestricted = allowedOrigins.length > 0 && !allowedOrigins.includes("*");
  if (sourceUrl.origin !== window.location.origin
      && originsAreRestricted
      && !allowedOrigins.includes(sourceUrl.origin)) {
    throw new Error("A origem da imagem PS2 não está autorizada nesta implantação.");
  }
  return RangeDiscDevice.create(sourceUrl.href);
}

async function loadGame(source: RomSource) {
  if (state !== "idle") throw new Error("A instância Play! já recebeu uma imagem.");
  assertPlatformSupport();
  setStatus("initializing", "Carregando o runtime Play!…");
  const pointer = await loadRuntimePointer();
  const runtimeBase = pointer.runtimePath;
  const scriptUrl = new URL(`${runtimeBase}Play.js`, window.location.origin).href;
  const imported: unknown = await import(/* @vite-ignore */ scriptUrl);
  const factory = (imported as { default?: PlayFactory }).default;
  if (typeof factory !== "function") throw new Error("O módulo Play.js não exportou uma factory válida.");
  discDevice = await createDiscDevice(source);
  playModule = await factory({
    canvas,
    locateFile: (path) => new URL(`${runtimeBase}${path}`, window.location.origin).href,
    mainScriptUrlOrBlob: scriptUrl,
    print: (message) => console.info(`[Play ${pointer.version}]`, message),
    printErr: (message) => console.error(`[Play ${pointer.version}]`, message),
  });
  if (typeof playModule.getRuntimeState !== "function" || typeof playModule.getRuntimeVersion !== "function"
      || typeof playModule.getLastError !== "function") {
    throw new Error("A API do runtime Play! não é compatível com este host.");
  }
  // getRuntimeVersion() pode retornar o commit interno, enquanto o manifesto usa
  // a tag da distribuição. A integridade dos arquivos já foi validada pelo lock.
  playModule.discImageDevice = discDevice;
  discDevice.attach(playModule);
  if (!playModule.init("#outputCanvas")) throw new Error("O Play! recusou a inicialização.");
  setStatus("loading", "Abrindo a imagem do PlayStation 2…");
  playModule.loadDisc(source.name);
  const loadDeadline = performance.now() + 90000;
  while (playModule.getRuntimeState() !== "running") {
    if (playModule.getRuntimeState() === "error") {
      throw new Error(playModule.getLastError() || "O Play! não conseguiu abrir esta imagem.");
    }
    if (performance.now() >= loadDeadline) {
      throw new Error("O Play! demorou demais para iniciar o disco.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }
  applyMasterVolume(desiredVolume);
  canvas.focus({ preventScroll: true });
  setStatus("running", "Emulação PS2 ativa");
}

function setInput(port: 0 | 1, control: Ps2InputControl, value: number) {
  if (!playModule || (state !== "running" && state !== "paused")) return;
  const key = `${port}:${control}`;
  if (inputValues.get(key) === value) return;
  inputValues.set(key, value);
  playModule.setInput(port, control, value);
}
function resetInputs() {
  if (!playModule) return;
  for (const [key, value] of inputValues) {
    const [portText, control] = key.split(":") as ["0" | "1", Ps2InputControl];
    if (value !== 0) playModule.setInput(Number(portText) as 0 | 1, control, 0);
  }
  inputValues.clear();
}

async function destroyRuntime(requestId?: string) {
  if (state === "destroyed") { send({ type: "destroyed", ...(requestId ? { requestId } : {}) }); return; }
  setStatus("destroying", "Encerrando Play!…");
  activation.style.display = "none";
  resetInputs();
  discDevice?.cancel();
  if (playModule) {
    playModule.pause();
    playModule.prepareDestroy();
    const deadline = performance.now() + 4500;
    while (!playModule.isReadyToDestroy() && performance.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
    if (!playModule.isReadyToDestroy() || !playModule.destroy()) throw new Error("O Play! não conseguiu liberar os recursos nativos.");
  }
  playModule = null; discDevice = null; inputValues.clear(); state = "destroyed";
  send({ type: "destroyed", ...(requestId ? { requestId } : {}) });
}

async function executeCommand(command: QueuedCommand) {
  try {
    if (command.type === "load") await loadGame(command.source);
    else if (command.type === "pause" && state === "running") { resetInputs(); playModule?.pause(); setStatus("paused", "Emulação pausada"); }
    else if (command.type === "resume" && state === "paused") { playModule?.resume(); setStatus("running", "Emulação PS2 ativa"); }
    else if (command.type === "destroy") { await destroyRuntime(command.requestId); return; }
    send({ type: "command-result", requestId: command.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna no host Play!.";
    if (command.type === "load") showFatal("PLAY_LOAD_FAILED", message);
    send({ type: "command-error", requestId: command.requestId, code: "PLAY_COMMAND_FAILED", message });
  }
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  if (!isPlayCommand(event.data, sessionId)) return;
  const command = event.data;
  if (command.type === "set-input") {
    if (command.frame.sequence <= lastExternalInputSequence) return;
    lastExternalInputSequence = command.frame.sequence;
    command.frame.values.forEach((input) => setInput(input.port, input.control, input.value));
    return;
  }
  if (command.type === "set-volume") { applyMasterVolume(command.volume); return; }
  const queuedCommand: QueuedCommand = command;
  if (queuedCommand.type === "destroy") discDevice?.cancel();
  commandQueue = commandQueue.then(() => executeCommand(queuedCommand));
});

function forwardKeyboard(event: KeyboardEvent) {
  if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  send({ type: "keyboard-input", code: event.code, pressed: event.type === "keydown", repeat: event.repeat });
}
window.addEventListener("keydown", forwardKeyboard, true);
window.addEventListener("keyup", forwardKeyboard, true);
window.addEventListener("blur", resetInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") {
    resetInputs(); playModule?.pause(); pausedByVisibility = true; setStatus("paused", "Emulação pausada em segundo plano");
  } else if (!document.hidden && pausedByVisibility && state === "paused") {
    playModule?.resume(); pausedByVisibility = false; setStatus("running", "Emulação PS2 ativa");
  }
});
window.addEventListener("pagehide", () => { void destroyRuntime().catch(() => undefined); });
const resumeAudio = () => {
  activation.style.display = "none";
  canvas.focus({ preventScroll: true });
  masterVolumeGains.forEach((gain) => {
    if (gain.context instanceof AudioContext) void gain.context.resume();
  });
};
window.addEventListener("pointerdown", resumeAudio, true);
window.addEventListener("keydown", resumeAudio, true);
window.addEventListener("error", (event) => showFatal("PLAY_HOST_ERROR", event.message || "Erro interno no host Play!."));
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error ? event.reason.message : "Falha assíncrona no host Play!.";
  showFatal("PLAY_HOST_REJECTION", message);
});

if (sessionId.length < 16) showFatal("PLAY_INVALID_SESSION", "A sessão do iframe Play! é inválida.");
else send({ type: "bridge-ready" });
