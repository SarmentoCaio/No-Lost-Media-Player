import { useEffect, useMemo, useRef, useState } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { Platform } from "../types/game";

interface EmulatorJSPlayerProps {
  platform: Exclude<Platform, "ps2">;
  romUrl: string;
  gameName: string;
  onError: (message: string) => void;
}

interface EmulatorMessage {
  source?: unknown;
  type?: unknown;
  message?: unknown;
}

export function EmulatorJSPlayer({ platform, romUrl, gameName, onError }: EmulatorJSPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState("Preparando emulador…");
  const [loading, setLoading] = useState(true);

  const emulatorUrl = useMemo(() => {
    const parameters = new URLSearchParams({
      core: emulatorConfig[platform].core,
      rom: romUrl,
      name: gameName,
    });
    return `/emulator/emulatorjs/index.html?${parameters.toString()}`;
  }, [gameName, platform, romUrl]);

  useEffect(() => {
    setLoading(true);
    setStatus("Preparando emulador…");

    const handleMessage = (event: MessageEvent<EmulatorMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "no-lost-emulator" || typeof data.type !== "string") return;

      if (data.type === "loading") {
        setStatus(typeof data.message === "string" ? data.message : "Carregando ROM…");
      } else if (data.type === "ready") {
        setLoading(false);
      } else if (data.type === "error") {
        setLoading(false);
        onError(typeof data.message === "string" ? data.message : "Não foi possível iniciar o emulador.");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [emulatorUrl, onError]);

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
}
