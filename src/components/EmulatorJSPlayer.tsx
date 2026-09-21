import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { Platform } from "../types/game";

interface EmulatorJSPlayerProps {
  platform: Exclude<Platform, "ps2">;
  romUrl: string;
  gameName: string;
  core?: string;
  onError: (message: string) => void;
  onReady?: (ready: boolean) => void;
}

interface EmulatorMessage {
  source?: unknown;
  type?: unknown;
  message?: unknown;
  requestId?: unknown;
  state?: unknown;
}

export interface EmulatorJSPlayerHandle {
  exportState: () => Promise<ArrayBuffer>;
  importState: (state: ArrayBuffer) => Promise<void>;
}

interface PendingRequest {
  resolve: (value: ArrayBuffer | void) => void;
  reject: (reason: Error) => void;
  timeout: number;
}

export const EmulatorJSPlayer = forwardRef<EmulatorJSPlayerHandle, EmulatorJSPlayerProps>(function EmulatorJSPlayer(
  { platform, romUrl, gameName, core, onError, onReady },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRequests = useRef(new Map<string, PendingRequest>());
  const [status, setStatus] = useState("Preparando emulador…");
  const [loading, setLoading] = useState(true);

  const emulatorUrl = useMemo(() => {
    const parameters = new URLSearchParams({
      core: core ?? emulatorConfig[platform].core,
      rom: romUrl,
      name: gameName,
    });
    return `/emulator/emulatorjs/index.html?${parameters.toString()}`;
  }, [core, gameName, platform, romUrl]);

  const sendCommand = (type: "export-state" | "import-state", state?: ArrayBuffer) => {
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
      }, 30000);
      pendingRequests.current.set(requestId, { resolve, reject, timeout });

      const message = { source: "no-lost-player", type, requestId, state };
      if (state) target.postMessage(message, window.location.origin, [state]);
      else target.postMessage(message, window.location.origin);
    });
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
      } else if (data.type === "state-exported" || data.type === "state-imported" || data.type === "state-error") {
        if (typeof data.requestId !== "string") return;
        const pending = pendingRequests.current.get(data.requestId);
        if (!pending) return;
        window.clearTimeout(pending.timeout);
        pendingRequests.current.delete(data.requestId);

        if (data.type === "state-error") {
          pending.reject(new Error(typeof data.message === "string" ? data.message : "Falha ao acessar o salvamento."));
        } else if (data.type === "state-exported") {
          if (data.state instanceof ArrayBuffer) pending.resolve(data.state);
          else pending.reject(new Error("O emulador retornou um salvamento inválido."));
        } else {
          pending.resolve();
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      onReady?.(false);
      for (const pending of pendingRequests.current.values()) {
        window.clearTimeout(pending.timeout);
        pending.reject(new Error("O emulador foi reiniciado."));
      }
      pendingRequests.current.clear();
    };
  }, [emulatorUrl, onError, onReady]);

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
        allow="fullscreen; gamepad"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
