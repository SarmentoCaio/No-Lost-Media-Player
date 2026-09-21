import type { Platform } from "../types/game";

interface PlatformIconProps {
  platform: Platform;
}

const commonProps = {
  viewBox: "0 0 120 76",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
} as const;

export function PlatformIcon({ platform }: PlatformIconProps) {
  if (platform === "snes") {
    return (
      <svg {...commonProps}>
        <path d="M22 22h76a13 13 0 0 1 13 13v20a10 10 0 0 1-17 7l-9-9H35l-9 9a10 10 0 0 1-17-7V35a13 13 0 0 1 13-13Z" />
        <path d="M28 31v17M19.5 39.5h17" />
        <circle cx="88" cy="35" r="4" className="platform-icon__accent-fill" />
        <circle cx="99" cy="44" r="4" className="platform-icon__accent-fill" />
        <circle cx="77" cy="44" r="4" />
        <circle cx="88" cy="53" r="4" />
        <path d="M50 48h8M63 48h8" className="platform-icon__soft" />
      </svg>
    );
  }

  if (platform === "n64") {
    return (
      <svg {...commonProps}>
        <path d="M25 18h70l17 17-8 28a7 7 0 0 1-12 2L75 45H45L28 65a7 7 0 0 1-12-2L8 35l17-17Z" />
        <path d="M49 36 40 66a6 6 0 0 0 11 5l9-15 9 15a6 6 0 0 0 11-5l-9-30" />
        <path d="M29 27v17M20.5 35.5h17" />
        <circle cx="88" cy="30" r="3.5" className="platform-icon__accent-fill" />
        <circle cx="97" cy="38" r="3.5" className="platform-icon__accent-fill" />
        <circle cx="60" cy="42" r="6" />
      </svg>
    );
  }

  if (platform === "ps1") {
    return (
      <svg {...commonProps}>
        <path d="M16 24h88l9 12v25H7V36l9-12Z" />
        <path d="M7 39h106M22 50h17M83 50h14" className="platform-icon__soft" />
        <ellipse cx="60" cy="34" rx="25" ry="11" />
        <path d="M44 34c5-7 27-7 32 0-5 7-27 7-32 0Z" className="platform-icon__accent-fill" />
        <circle cx="28" cy="31" r="3" />
        <path d="M90 28h8" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M38 8h39v57H38z" />
      <path d="M44 14h27v45H44zM77 13l8 5v47l-8-5" className="platform-icon__soft" />
      <path d="M44 19h27M44 23h27" className="platform-icon__accent-stroke" />
      <path d="M29 65h63v5H29z" />
      <circle cx="80.5" cy="55" r="1.8" className="platform-icon__accent-fill" />
      <path d="M48 31h19" />
    </svg>
  );
}
