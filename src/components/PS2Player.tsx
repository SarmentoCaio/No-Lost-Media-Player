import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { PlayPs2Adapter } from "../emulators/PlayPs2Adapter";
import {
  PLAY_PS2_CAPABILITIES,
  type InputFrame,
  type PlayerAdapter,
  type PlayerEventListener,
  type RomSource,
} from "../emulators/PlayerAdapter";

interface PS2PlayerProps {
  source: RomSource;
  gameName: string;
  onReady?: (ready: boolean) => void;
  onError: (message: string) => void;
}

export const PS2Player = forwardRef<PlayerAdapter, PS2PlayerProps>(function PS2Player(
  { source, gameName, onReady, onError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const adapterRef = useRef<PlayPs2Adapter | null>(null);
  const [status, setStatus] = useState("Preparando Play!…");
  const [loading, setLoading] = useState(true);

  const currentAdapter = () => {
    if (!adapterRef.current) throw new Error("O adaptador Play! ainda não está disponível.");
    return adapterRef.current;
  };

  useImperativeHandle(ref, () => ({
    capabilities: PLAY_PS2_CAPABILITIES,
    load: (nextSource: RomSource) => currentAdapter().load(nextSource),
    pause: () => currentAdapter().pause(),
    resume: () => currentAdapter().resume(),
    destroy: () => adapterRef.current?.destroy() ?? Promise.resolve(),
    setInput: (frame: InputFrame) => adapterRef.current?.setInput(frame),
    exportState: () => currentAdapter().exportState(),
    importState: (state: ArrayBuffer) => currentAdapter().importState(state),
    openNetplay: () => currentAdapter().openNetplay(),
    openControls: () => currentAdapter().openControls(),
    subscribe: (listener: PlayerEventListener) => adapterRef.current?.subscribe(listener) ?? (() => undefined),
  }));

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const adapter = new PlayPs2Adapter(iframe);
    adapterRef.current = adapter;
    setLoading(true);
    onReady?.(false);

    const unsubscribe = adapter.subscribe((event) => {
      if (event.message) setStatus(event.message);
      if (event.state === "running") {
        setLoading(false);
        onReady?.(true);
      } else if (event.state === "error") {
        setLoading(false);
        onReady?.(false);
        onError(event.message ?? "Não foi possível iniciar o Play!.");
      } else if (event.state === "destroyed") {
        onReady?.(false);
      }
    });

    adapter.load(source).catch((error: unknown) => {
      setLoading(false);
      onReady?.(false);
      onError(error instanceof Error ? error.message : "Não foi possível carregar a imagem PS2.");
    });

    return () => {
      unsubscribe();
      adapterRef.current = null;
      void adapter.destroy().catch(() => undefined);
      onReady?.(false);
    };
  }, [onError, onReady, source]);

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
        title={`Play! — ${gameName}`}
        allow="fullscreen; gamepad; autoplay"
        sandbox="allow-scripts allow-same-origin"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
