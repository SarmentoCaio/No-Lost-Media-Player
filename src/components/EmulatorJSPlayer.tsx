import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import { resolvePlayableRomUrl } from "../utils/rom";
import type { Platform } from "../types/game";
import type { RawKeyboardInput } from "../input/controlTypes";

interface EmulatorJSPlayerProps {
  platform: Exclude<Platform, "ps2">;
  romUrl: string;
  gameName: string;
  gameId: string;
  core?: string;
  volume: number;
  keyboardCodes: string[];
  onKeyboardInput: (input: RawKeyboardInput) => void;
  onError: (message: string) => void;
  onReady?: (ready: boolean) => void;
}

interface EmulatorMessage {
  source?: unknown;
  type?: unknown;
  message?: unknown;
  requestId?: unknown;
  state?: unknown;
  code?: unknown;
  pressed?: unknown;
  repeat?: unknown;
}

export interface EmulatorJSPlayerHandle {
  exportState: () => Promise<ArrayBuffer>;
  importState: (state: ArrayBuffer) => Promise<void>;
  openNetplay: () => Promise<void>;
  openControls: () => Promise<void>;
  setVolume: (volume: number) => void;
  setInput: (coreIndex: number, value: number) => void;
  releaseAllInputs: () => void;
  configureInput: (codes: string[]) => void;
}

interface PendingRequest {
  resolve: (value: ArrayBuffer | void) => void;
  reject: (reason: Error) => void;
  timeout: number;
}

export const EmulatorJSPlayer = forwardRef<EmulatorJSPlayerHandle, EmulatorJSPlayerProps>(function EmulatorJSPlayer(
  { platform, romUrl, gameName, gameId, core, volume, keyboardCodes, onKeyboardInput, onError, onReady },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRequests = useRef(new Map<string, PendingRequest>());
  const [status, setStatus] = useState("Preparando emulador…");
  const [loading, setLoading] = useState(true);
  const netplayServer = import.meta.env.VITE_NETPLAY_SERVER_URL?.trim()
    || "https://no-lost-media-netplay-sarmentocaio.onrender.com";

  const numericGameId = useMemo(() => {
    let hash = 2166136261;
    const value = `${platform}:${gameId}`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
  }, [gameId, platform]);

  const emulatorUrl = useMemo(() => {
    const parameters = new URLSearchParams({
      core: core ?? emulatorConfig[platform].core,
      rom: resolvePlayableRomUrl(romUrl),
      name: gameName,
      gameId: String(numericGameId),
      netplayServer,
    });
    return `/emulator/emulatorjs/index.html?${parameters.toString()}`;
  }, [core, gameName, netplayServer, numericGameId, platform, romUrl]);

  const sendCommand = (
    type: "export-state" | "import-state" | "open-netplay" | "open-controls",
    state?: ArrayBuffer,
  ) => {
    return new Promise<ArrayBuffer | void>((resolve, reject) => {
      const target = iframeRef.current?.contentWindow;
      if (!target) {
        reject(new Error("O emulador ainda não está disponível."));
        return;
      }

      const requestId = crypto.randomUUID();
      const timeout = window.setTimeout(() => {
        pendingRequests.current.delete(requestId);
        reject(new Error("O emulador demorou demais para responder."));
      }, type === "open-netplay" ? 90000 : 30000);
      pendingRequests.current.set(requestId, { resolve, reject, timeout });

      const message = { source: "no-lost-player", type, requestId, state };
      if (state) target.postMessage(message, window.location.origin, [state]);
      else target.postMessage(message, window.location.origin);
    });
  };

  const post = (message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "no-lost-player", ...message },
      window.location.origin,
    );
  };

  useImperativeHandle(ref, () => ({
    exportState: async () => {
      const state = await sendCommand("export-state");
      if (!(state instanceof ArrayBuffer)) throw new Error("O emulador não retornou um salvamento válido.");
      return state;
    },
    importState: async (state) => {
      await sendCommand("import-state", state);
    },
    openNetplay: async () => {
      await sendCommand("open-netplay");
    },
    openControls: async () => {
      await sendCommand("open-controls");
    },
    setVolume: (nextVolume) => post({ type: "set-volume", volume: nextVolume }),
    setInput: (coreIndex, value) => post({ type: "input", coreIndex, value }),
    releaseAllInputs: () => post({ type: "release-all-inputs" }),
    configureInput: (codes) => post({ type: "configure-input", codes }),
  }), [emulatorUrl]);

  useEffect(() => {
    setLoading(true);
    setStatus("Preparando emulador…");
    onReady?.(false);

    const handleMessage = (event: MessageEvent<EmulatorMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "no-lost-emulator" || typeof data.type !== "string") return;

      if (data.type === "loading") {
        setStatus(typeof data.message === "string" ? data.message : "Carregando ROM…");
      } else if (data.type === "ready") {
        setLoading(false);
        onReady?.(true);
      } else if (data.type === "error") {
        setLoading(false);
        onError(typeof data.message === "string" ? data.message : "Não foi possível iniciar o emulador.");
      } else if (data.type === "keyboard-input") {
        if (typeof data.code === "string" && typeof data.pressed === "boolean") {
          onKeyboardInput({ code: data.code, pressed: data.pressed, repeat: data.repeat === true });
        }
      } else if (
        data.type === "state-exported"
        || data.type === "state-imported"
        || data.type === "netplay-opened"
        || data.type === "controls-opened"
        || data.type === "command-error"
      ) {
        if (typeof data.requestId !== "string") return;
        const pending = pendingRequests.current.get(data.requestId);
        if (!pending) return;
        window.clearTimeout(pending.timeout);
        pendingRequests.current.delete(data.requestId);

        if (data.type === "command-error") {
          pending.reject(new Error(typeof data.message === "string" ? data.message : "Falha ao acessar o salvamento."));
        } else if (data.type === "state-exported") {
          if (data.state instanceof ArrayBuffer) pending.resolve(data.state);
          else pending.reject(new Error("O emulador retornou um salvamento inválido."));
        } else {
          pending.resolve();
        }
      }
    };

    const shutdownEmulator = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { source: "no-lost-player", type: "shutdown" },
        window.location.origin,
      );
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("pagehide", shutdownEmulator);
    return () => {
      shutdownEmulator();
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("pagehide", shutdownEmulator);
      onReady?.(false);
      for (const pending of pendingRequests.current.values()) {
        window.clearTimeout(pending.timeout);
        pending.reject(new Error("O emulador foi reiniciado."));
      }
      pendingRequests.current.clear();
    };
  }, [emulatorUrl, onError, onKeyboardInput, onReady]);

  useEffect(() => {
    post({ type: "set-volume", volume });
  }, [volume]);

  useEffect(() => {
    post({ type: "configure-input", codes: keyboardCodes });
  }, [keyboardCodes]);

  return (
    <div className="emulator-frame-wrap">
      {loading && (
        <div className="loading-overlay" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>{status}</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="emulator-frame"
        src={emulatorUrl}
        title={`Emulador — ${gameName}`}
        allow="fullscreen; gamepad; autoplay"
        onLoad={() => {
          post({ type: "configure-input", codes: keyboardCodes });
          post({ type: "set-volume", volume });
        }}
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
