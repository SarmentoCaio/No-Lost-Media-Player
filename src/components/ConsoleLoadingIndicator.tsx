import type { Platform } from "../types/game";

interface ConsoleLoadingIndicatorProps {
  platform: Platform;
  progress: number;
}

const mediaNames: Record<Platform, string> = {
  nes: "Cartucho NES",
  snes: "Cartucho Super Nintendo",
  gba: "Cartucho Game Boy Advance",
  n64: "Cartucho Nintendo 64",
  ps1: "CD PlayStation",
  ps2: "DVD PlayStation 2",
};

export function ConsoleLoadingIndicator({ platform, progress }: ConsoleLoadingIndicatorProps) {
  const roundedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const isDisc = platform === "ps1" || platform === "ps2";

  return (
    <div
      className={`console-loader console-loader--${isDisc ? "disc" : "cartridge"} console-loader--${platform}`}
      style={{
        "--load-progress": roundedProgress,
        "--load-width": `${roundedProgress}%`,
        "--load-offset": `${(100 - roundedProgress) * -0.53}px`,
        "--disc-offset": `${(100 - roundedProgress) * -0.38}px`,
        "--disc-rotation": `${roundedProgress * 5}deg`,
        "--disc-scale": 0.55 + roundedProgress * 0.0045,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="console-loader__stage">
        {isDisc ? (
          <>
            <span className="console-loader__tray"><i /></span>
            <span className="console-loader__disc"><i>{platform === "ps2" ? "PS2" : "PS"}</i></span>
          </>
        ) : (
          <>
            <span className="console-loader__slot"><i /></span>
            <span className="console-loader__cartridge">
              <i>{platform.toUpperCase()}</i>
              <b>NO LOST</b>
              <em />
            </span>
          </>
        )}
      </div>
      <div className="console-loader__meter">
        <span><i /></span>
        <b>{roundedProgress}%</b>
      </div>
      <small>{mediaNames[platform]}</small>
    </div>
  );
}
