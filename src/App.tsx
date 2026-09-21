import { useEffect, useRef, useState } from "react";
import { isPlatform } from "./emulators/emulatorConfig";
import type { PlayerLaunch } from "./types/game";
import { Home } from "./pages/Home";
import { Player } from "./pages/Player";

interface HistoryState {
  launch?: PlayerLaunch;
}

function launchFromLocation(): PlayerLaunch | null {
  const match = window.location.pathname.match(/^\/play\/([^/]+)\/?$/);
  if (!match?.[1] || !isPlatform(match[1])) return null;

  const state = window.history.state as HistoryState | null;
  if (state?.launch?.platform === match[1]) return state.launch;

  const params = new URLSearchParams(window.location.search);
  const romUrl = params.get("rom");
  if (!romUrl) return null;
  return {
    gameId: params.get("id") ?? "jogo",
    title: params.get("name") ?? "Jogo",
    platform: match[1],
    romUrl,
    source: romUrl.startsWith("blob:") ? "local" : "url",
  };
}

export default function App() {
  const [launch, setLaunch] = useState<PlayerLaunch | null>(() => launchFromLocation());
  const localObjectUrl = useRef<string | null>(launch?.source === "local" ? launch.romUrl : null);

  useEffect(() => {
    const handlePopState = () => setLaunch(launchFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => () => {
    if (localObjectUrl.current) URL.revokeObjectURL(localObjectUrl.current);
  }, []);

  const openPlayer = (nextLaunch: PlayerLaunch) => {
    if (localObjectUrl.current) URL.revokeObjectURL(localObjectUrl.current);
    localObjectUrl.current = nextLaunch.source === "local" ? nextLaunch.romUrl : null;

    const params = new URLSearchParams({
      rom: nextLaunch.romUrl,
      name: nextLaunch.title,
      id: nextLaunch.gameId,
    });
    const path = `/play/${nextLaunch.platform}?${params.toString()}`;
    window.history.pushState({ launch: nextLaunch }, "", path);
    setLaunch(nextLaunch);
  };

  const goHome = () => {
    if (localObjectUrl.current) {
      URL.revokeObjectURL(localObjectUrl.current);
      localObjectUrl.current = null;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, "", "/");
    setLaunch(null);
  };

  if (launch) return <Player launch={launch} onBack={goHome} />;
  return <Home onStart={openPlayer} />;
}
