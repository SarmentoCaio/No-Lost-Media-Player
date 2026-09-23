import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { RawKeyboardInput } from "../input/controlTypes";
import { PlayPs2Adapter } from "../emulators/PlayPs2Adapter";
import type { InputValue, Ps2InputControl, RomSource } from "../emulators/PlayerAdapter";
import type { EmulatorJSPlayerHandle } from "./EmulatorJSPlayer";
import { ConsoleLoadingIndicator } from "./ConsoleLoadingIndicator";
import { getFileExtension, isSupportedRom } from "../utils/rom";

interface PS2PlayerProps {
  romUrl: string;
  romFile?: File;
  gameName: string;
  volume: number;
  onKeyboardInput: (input: RawKeyboardInput) => void;
  onReady?: (ready: boolean) => void;
  onError: (message: string) => void;
}

const buttonControls: Readonly<Record<number, Ps2InputControl>> = {
  0: "cross",
  1: "square",
  2: "select",
  3: "start",
  4: "dpadUp",
  5: "dpadDown",
  6: "dpadLeft",
  7: "dpadRight",
  8: "circle",
  9: "triangle",
  10: "l1",
  11: "r1",
  12: "l2",
  13: "r2",
  14: "l3",
  15: "r3",
};

const analogControls: Readonly<Record<number, { control: Ps2InputControl; direction: -1 | 1 }>> = {
  16: { control: "leftX", direction: 1 },
  17: { control: "leftX", direction: -1 },
  18: { control: "leftY", direction: 1 },
  19: { control: "leftY", direction: -1 },
  20: { control: "rightX", direction: 1 },
  21: { control: "rightX", direction: -1 },
  22: { control: "rightY", direction: 1 },
  23: { control: "rightY", direction: -1 },
};

function playableRomUrl(romUrl: string): string {
  try {
    let clean = romUrl.trim();
    while (clean.includes("%25")) {
      try { clean = decodeURIComponent(clean); } catch { break; }
    }
    const url = new URL(clean);
    if (url.protocol === "https:"
      && (url.hostname === "archive.org" || url.hostname.endsWith(".archive.org"))) {
      url.pathname = url.pathname
        .split("/")
        .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
        .join("/");
      return `/api/rom?v=5&url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    // Caminhos relativos e URLs blob permanecem inalterados.
  }
  return romUrl;
}

export const PS2Player = forwardRef<EmulatorJSPlayerHandle, PS2PlayerProps>(function PS2Player(
  { romUrl, romFile, gameName, volume, onKeyboardInput, onReady, onError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const adapterRef = useRef<PlayPs2Adapter | null>(null);
  const sequenceRef = useRef(0);
  const inputValuesRef = useRef(new Map<number, number>());
  const [status, setStatus] = useState("Preparando o Play!…");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(4);
  const progressTargetRef = useRef(8);

  const source = useMemo<RomSource>(() => romFile
    ? { kind: "file", file: romFile, name: romFile.name }
    : { kind: "url", url: playableRomUrl(romUrl), name: gameName }, [gameName, romFile, romUrl]);
  const remoteExtension = romFile ? "" : getFileExtension(romUrl);
  const unsupportedRemoteExtension = remoteExtension && !isSupportedRom(romUrl, "ps2")
    ? remoteExtension
    : null;

  const sendValues = (values: InputValue[]) => {
    if (values.length === 0) return;
    adapterRef.current?.setInput({ sequence: sequenceRef.current++, values });
  };

  useImperativeHandle(ref, () => ({
    exportState: () => Promise.reject(new Error("O runtime Play! atual ainda não oferece save states.")),
    importState: () => Promise.reject(new Error("O runtime Play! atual ainda não oferece save states.")),
    openNetplay: () => Promise.reject(new Error("O modo online ainda não está disponível para PlayStation 2.")),
    openControls: () => Promise.resolve(),
    setVolume: (nextVolume) => adapterRef.current?.setVolume(nextVolume),
    setInput: (coreIndex, rawValue) => {
      const value = Math.min(1, Math.max(0, rawValue));
      inputValuesRef.current.set(coreIndex, value);
      const button = buttonControls[coreIndex];
      if (button) {
        sendValues([{ port: 0, control: button, value }]);
        return;
      }
      const analog = analogControls[coreIndex];
      if (!analog) return;
      const positiveIndex = Object.entries(analogControls)
        .find(([, item]) => item.control === analog.control && item.direction === 1)?.[0];
      const negativeIndex = Object.entries(analogControls)
        .find(([, item]) => item.control === analog.control && item.direction === -1)?.[0];
      const positive = positiveIndex ? inputValuesRef.current.get(Number(positiveIndex)) ?? 0 : 0;
      const negative = negativeIndex ? inputValuesRef.current.get(Number(negativeIndex)) ?? 0 : 0;
      sendValues([{ port: 0, control: analog.control, value: positive - negative }]);
    },
    releaseAllInputs: () => {
      inputValuesRef.current.clear();
      const controls = [...new Set([
        ...Object.values(buttonControls),
        ...Object.values(analogControls).map((item) => item.control),
      ])];
      sendValues(controls.map((control) => ({ port: 0 as const, control, value: 0 })));
    },
    configureInput: () => undefined,
    setFastForward: () => undefined,
    setPaused: (paused) => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      void (paused ? adapter.pause() : adapter.resume()).catch((error: unknown) => {
        onError(error instanceof Error ? error.message : "Não foi possível alterar a pausa do Play!.");
      });
    },
  }), [onError]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (unsupportedRemoteExtension) {
      setLoading(false);
      onReady?.(false);
      onError(`O Play! não abre ${unsupportedRemoteExtension} diretamente. Extraia o jogo e use uma imagem .iso, .bin, .chd ou .cso.`);
      return;
    }
    const adapter = new PlayPs2Adapter(iframe, onKeyboardInput);
    let active = true;
    adapterRef.current = adapter;
    sequenceRef.current = 0;
    inputValuesRef.current.clear();
    setStatus("Preparando o Play!…");
    setProgress(4);
    progressTargetRef.current = 10;
    setLoading(true);
    onReady?.(false);

    const unsubscribe = adapter.subscribe((event) => {
      if (!active) return;
      if (event.message) setStatus(event.message);
      if (event.state === "initializing") progressTargetRef.current = 34;
      else if (event.state === "loading") progressTargetRef.current = 78;
      else if (event.state === "running") {
        setProgress(100);
        window.setTimeout(() => setLoading(false), 320);
        onReady?.(true);
      } else if (event.state === "error") {
        setLoading(false);
        onReady?.(false);
        onError(event.message ?? "Não foi possível iniciar o Play!.");
      } else if (event.state === "destroyed") {
        onReady?.(false);
      }
    });

    adapter.setVolume(volume);
    adapter.load(source).catch((error: unknown) => {
      if (!active) return;
      setLoading(false);
      onReady?.(false);
      onError(error instanceof Error ? error.message : "Não foi possível carregar a imagem PS2.");
    });

    return () => {
      active = false;
      unsubscribe();
      if (adapterRef.current === adapter) adapterRef.current = null;
      void adapter.destroy().catch(() => undefined);
    };
  }, [onError, onKeyboardInput, onReady, source, unsupportedRemoteExtension]);

  useEffect(() => {
    adapterRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(progressTargetRef.current, current + Math.max(1, Math.ceil((progressTargetRef.current - current) * 0.08))));
    }, 180);
    return () => window.clearInterval(timer);
  }, [loading]);

  return (
    <div className="emulator-frame-wrap">
      {loading && (
        <div className="loading-overlay" role="status">
          <ConsoleLoadingIndicator platform="ps2" progress={progress} />
          <div className="loading-overlay__copy">
            <strong>Preparando {gameName}</strong>
            <span>{status}</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="emulator-frame"
        title={`Play! — ${gameName}`}
        allow="fullscreen; gamepad; autoplay"
        sandbox="allow-scripts allow-same-origin"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
