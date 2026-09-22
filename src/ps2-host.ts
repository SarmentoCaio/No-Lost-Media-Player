import type { Ps2InputControl, RomSource } from "./emulators/PlayerAdapter";
import { isPlayCommand, makeEnvelope, type PlayCommand, type PlayEvent } from "./emulators/playProtocol";
import { FileDiscDevice, RangeDiscDevice, type DiscImageDevice } from "./emulators/ps2DiscDevice";

interface RuntimePointer {
  version: string;
  runtimePath: string;
}

interface RuntimeManifest {
  version: string;
  emscripten: string;
  threadPoolSize: number;
}

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
let gamepadFrame = 0;
const inputValues = new Map<string, number>();
const keyboardValues = new Map<Ps2InputControl, number>();
const gamepadValues = new Map<string, number>();
const externalValues = new Map<string, number>();

type PlayEventPayload = PlayEvent extends infer Event
  ? Event extends PlayEvent
    ? Omit<Event, "protocol" | "version" | "sessionId">
    : never
  : never;
type QueuedCommand = Exclude<PlayCommand, { type: "set-input" }>;

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

async function loadRuntimePointer(): Promise<RuntimePointer> {
	const response = await fetch("/emulator/ps2/play-runtime.json", { cache: "no-store" });
  if (!response.ok) throw new Error("O runtime Play! ainda não foi publicado nesta implantação.");
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null) throw new Error("O ponteiro do runtime Play! é inválido.");
  const candidate = value as Partial<RuntimePointer>;
  if (typeof candidate.version !== "string" || typeof candidate.runtimePath !== "string") {
    throw new Error("O ponteiro do runtime Play! está incompleto.");
  }
  const runtimeUrl = new URL(candidate.runtimePath, window.location.origin);
  if (runtimeUrl.origin !== window.location.origin) throw new Error("O runtime Play! precisa ser same-origin.");
  const pointer = { version: candidate.version, runtimePath: runtimeUrl.pathname.replace(/\/?$/, "/") };
  const manifestResponse = await fetch(`${pointer.runtimePath}runtime-manifest.json`, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("O manifesto do runtime Play! não está disponível.");
  const manifest: unknown = await manifestResponse.json();
  if (typeof manifest !== "object" || manifest === null) throw new Error("O manifesto do runtime Play! é inválido.");
  const candidateManifest = manifest as Partial<RuntimeManifest>;
  if (candidateManifest.version !== pointer.version
      || candidateManifest.emscripten !== "4.0.1"
      || candidateManifest.threadPoolSize !== 2) {
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
  const allowedOrigins = (import.meta.env.VITE_PS2_ROM_ORIGINS ?? "")
    .split(",")
    .map((origin: string) => origin.trim())
    .filter(Boolean);
  const sourceOrigin = new URL(source.url).origin;
  if (!allowedOrigins.includes(sourceOrigin)) {
    throw new Error("A origem da imagem PS2 não está autorizada nesta implantação.");
  }
  return RangeDiscDevice.create(source.url);
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
  if (typeof playModule.getRuntimeState !== "function" || typeof playModule.getRuntimeVersion !== "function") {
    throw new Error("A API do runtime Play! não é compatível com este host.");
  }
  playModule.discImageDevice = discDevice;
  discDevice.attach(playModule);
  if (!playModule.init("#outputCanvas")) throw new Error("O Play! recusou a inicialização.");
  setStatus("loading", "Abrindo a imagem do PlayStation 2…");
  playModule.loadDisc(source.name);
  canvas.focus({ preventScroll: true });
  activation.style.display = "grid";
  setStatus("running", "Emulação PS2 ativa");
  startGamepadPolling();
}

function setInput(port: 0 | 1, control: Ps2InputControl, value: number) {
  if (!playModule || (state !== "running" && state !== "paused")) return;
  const key = `${port}:${control}`;
  if (inputValues.get(key) === value) return;
  inputValues.set(key, value);
  playModule.setInput(port, control, value);
}

function applyInputSources(port: 0 | 1, control: Ps2InputControl) {
  const key = `${port}:${control}`;
  const keyboard = port === 0 ? keyboardValues.get(control) ?? 0 : 0;
  const gamepad = gamepadValues.get(key) ?? 0;
  const external = externalValues.get(key) ?? 0;
  const isAxis = control.endsWith("X") || control.endsWith("Y");
  setInput(port, control, isAxis
    ? (externalValues.has(key) ? external : gamepad)
    : Math.max(keyboard, gamepad, external));
}

function resetInputs() {
  if (!playModule) return;
  for (const [key, value] of inputValues) {
    const [portText, control] = key.split(":") as ["0" | "1", Ps2InputControl];
    const neutral = control.endsWith("X") || control.endsWith("Y") ? 0 : 0;
    if (value !== neutral) playModule.setInput(Number(portText) as 0 | 1, control, neutral);
  }
  inputValues.clear();
  keyboardValues.clear();
  gamepadValues.clear();
  externalValues.clear();
}

function resetPort(port: 0 | 1) {
  if (!playModule) return;
  for (const [key] of [...gamepadValues]) {
    if (!key.startsWith(`${port}:`)) continue;
    const control = key.slice(2) as Ps2InputControl;
    gamepadValues.delete(key);
    applyInputSources(port, control);
  }
}

const keyboardMap: Readonly<Record<string, Ps2InputControl>> = {
  ArrowUp: "dpadUp", ArrowDown: "dpadDown", ArrowLeft: "dpadLeft", ArrowRight: "dpadRight",
  Enter: "start", Backspace: "select",
  KeyA: "square", KeyS: "triangle", KeyX: "circle", KeyZ: "cross",
  KeyQ: "l1", KeyW: "l2", ShiftLeft: "l3", KeyE: "r1", KeyR: "r2", ShiftRight: "r3",
};

function handleKeyboard(event: KeyboardEvent, value: number) {
  if (event.repeat || event.isComposing) return;
  const control = keyboardMap[event.code];
  if (!control) return;
  event.preventDefault();
  keyboardValues.set(control, value);
  applyInputSources(0, control);
}

function pollGamepads() {
  gamepadFrame = window.requestAnimationFrame(pollGamepads);
  if (!playModule || state !== "running") return;
  const pads = navigator.getGamepads().filter((pad): pad is Gamepad => Boolean(pad && pad.mapping === "standard")).slice(0, 2);
  const buttonMap: Array<[number, Ps2InputControl]> = [
    [0, "cross"], [1, "circle"], [2, "square"], [3, "triangle"],
    [4, "l1"], [5, "r1"], [6, "l2"], [7, "r2"], [8, "select"], [9, "start"],
    [10, "l3"], [11, "r3"], [12, "dpadUp"], [13, "dpadDown"], [14, "dpadLeft"], [15, "dpadRight"],
  ];
  const axisMap: Array<[number, Ps2InputControl]> = [[0, "leftX"], [1, "leftY"], [2, "rightX"], [3, "rightY"]];
  if (!pads[0]) resetPort(0);
  if (!pads[1]) resetPort(1);
  pads.forEach((pad, port) => {
    buttonMap.forEach(([index, control]) => {
      gamepadValues.set(`${port}:${control}`, pad.buttons[index]?.value ?? 0);
      applyInputSources(port as 0 | 1, control);
    });
    axisMap.forEach(([index, control]) => {
      const value = Math.abs(pad.axes[index] ?? 0) < 0.08 ? 0 : pad.axes[index];
      gamepadValues.set(`${port}:${control}`, value);
      applyInputSources(port as 0 | 1, control);
    });
  });
}

function startGamepadPolling() {
  if (!gamepadFrame) gamepadFrame = window.requestAnimationFrame(pollGamepads);
}

async function destroyRuntime(requestId?: string) {
  if (state === "destroyed") {
    send({ type: "destroyed", ...(requestId ? { requestId } : {}) });
    return;
  }
  setStatus("destroying", "Encerrando Play!…");
  activation.style.display = "none";
  if (gamepadFrame) window.cancelAnimationFrame(gamepadFrame);
  gamepadFrame = 0;
  resetInputs();
  discDevice?.cancel();
  if (playModule) {
    playModule.pause();
    playModule.prepareDestroy();
    const deadline = performance.now() + 4500;
    while (!playModule.isReadyToDestroy() && performance.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
    if (!playModule.isReadyToDestroy() || !playModule.destroy()) {
      throw new Error("O Play! não conseguiu liberar todos os recursos nativos.");
    }
  }
  playModule = null;
  discDevice = null;
  inputValues.clear();
  state = "destroyed";
  send({ type: "destroyed", ...(requestId ? { requestId } : {}) });
}

async function executeCommand(command: QueuedCommand) {
  try {
    if (command.type === "load") await loadGame(command.source);
    else if (command.type === "pause") {
      if (state === "running") {
        resetInputs();
        playModule?.pause();
        setStatus("paused", "Emulação pausada");
      }
    } else if (command.type === "resume") {
      if (state === "paused") {
        playModule?.resume();
        setStatus("running", "Emulação PS2 ativa");
      }
    } else if (command.type === "destroy") {
      await destroyRuntime(command.requestId);
      return;
    }
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
    command.frame.values.forEach((input) => {
      externalValues.set(`${input.port}:${input.control}`, input.value);
      applyInputSources(input.port, input.control);
    });
    return;
  }
  const queuedCommand: QueuedCommand = command;
  if (queuedCommand.type === "destroy") discDevice?.cancel();
  commandQueue = commandQueue.then(() => executeCommand(queuedCommand));
});

window.addEventListener("keydown", (event) => handleKeyboard(event, 1));
window.addEventListener("keyup", (event) => handleKeyboard(event, 0));
window.addEventListener("blur", resetInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") {
    resetInputs();
    playModule?.pause();
    pausedByVisibility = true;
    setStatus("paused", "Emulação pausada em segundo plano");
  } else if (!document.hidden && pausedByVisibility && state === "paused") {
    playModule?.resume();
    pausedByVisibility = false;
    setStatus("running", "Emulação PS2 ativa");
  }
});
window.addEventListener("pagehide", () => { void destroyRuntime().catch(() => undefined); });
activation.querySelector("button")?.addEventListener("click", () => {
  activation.style.display = "none";
  canvas.focus({ preventScroll: true });
});
window.addEventListener("error", (event) => showFatal("PLAY_HOST_ERROR", event.message || "Erro interno no host Play!."));
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error ? event.reason.message : "Falha assíncrona no host Play!.";
  showFatal("PLAY_HOST_REJECTION", message);
});

if (sessionId.length < 16) showFatal("PLAY_INVALID_SESSION", "A sessão do iframe Play! é inválida.");
else send({ type: "bridge-ready" });
