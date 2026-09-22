import { availablePlatforms } from "../emulators/emulatorConfig";
import type { Platform } from "../types/game";
import { PlatformIcon } from "./PlatformIcon";

interface PlatformSelectorProps {
  selected: Platform | null;
  onSelect: (platform: Platform) => void;
}

export function PlatformSelector({ selected, onSelect }: PlatformSelectorProps) {
  return (
    <div className="platform-grid" role="radiogroup" aria-label="Plataforma">
      {availablePlatforms.map((platform) => (
        <button
          className={`platform-card${selected === platform.id ? " platform-card--selected" : ""}`}
          key={platform.id}
          type="button"
          role="radio"
          aria-checked={selected === platform.id}
          onClick={() => onSelect(platform.id)}
          style={{ "--platform-accent": platform.accent } as React.CSSProperties}
        >
          <span className="platform-card__topline">
            <span className="platform-card__badge">{platform.shortName}</span>
            <span className="platform-card__availability">
              <span aria-hidden="true" />
              {platform.engine === "play" ? "Em breve" : "Disponível"}
            </span>
          </span>
          <span className="platform-card__visual">
            <PlatformIcon platform={platform.id} />
          </span>
          <span className="platform-card__content">
            <span className="platform-card__name">{platform.name}</span>
            <span className="platform-card__engine">
              {platform.engine === "play" ? "Play! WebAssembly" : "Via EmulatorJS"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
