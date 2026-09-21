import { useEffect, useState } from "react";

function findConnectedGamepad(): Gamepad | null {
  if (!("getGamepads" in navigator)) return null;
  return Array.from(navigator.getGamepads()).find((gamepad) => gamepad?.connected) ?? null;
}

export function useGamepad(): Gamepad | null {
  const [gamepad, setGamepad] = useState<Gamepad | null>(() => findConnectedGamepad());

  useEffect(() => {
    const update = () => setGamepad(findConnectedGamepad());
    const handleConnected = (event: GamepadEvent) => setGamepad(event.gamepad);
    const handleDisconnected = () => update();
    const pollingId = window.setInterval(update, 1_500);

    window.addEventListener("gamepadconnected", handleConnected);
    window.addEventListener("gamepaddisconnected", handleDisconnected);
    update();

    return () => {
      window.clearInterval(pollingId);
      window.removeEventListener("gamepadconnected", handleConnected);
      window.removeEventListener("gamepaddisconnected", handleDisconnected);
    };
  }, []);

  return gamepad;
}
