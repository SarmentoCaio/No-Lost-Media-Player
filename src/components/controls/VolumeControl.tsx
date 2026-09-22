import type { AudioSettings } from "../../input/controlTypes";

interface VolumeControlProps {
  audio: AudioSettings;
  onChange: (audio: AudioSettings) => void;
  compact?: boolean;
}

function volumeIcon(volume: number, muted: boolean) {
  if (muted || volume === 0) return "🔇";
  if (volume < 0.34) return "🔈";
  if (volume < 0.67) return "🔉";
  return "🔊";
}

export function VolumeControl({ audio, onChange, compact }: VolumeControlProps) {
  const effective = audio.muted ? 0 : audio.volume;
  const setVolume = (volume: number) => onChange({
    volume,
    muted: volume === 0,
    previousVolume: volume > 0 ? volume : audio.previousVolume,
  });
  const toggleMute = () => {
    if (audio.muted || audio.volume === 0) {
      const restored = audio.previousVolume || 0.8;
      onChange({ volume: restored, muted: false, previousVolume: restored });
    } else {
      onChange({ ...audio, muted: true, previousVolume: audio.volume });
    }
  };
  return (
    <div className={`volume-control${compact ? " volume-control--compact" : ""}`}>
      <button type="button" onClick={toggleMute} aria-label={audio.muted ? "Ativar som" : "Silenciar"} title={audio.muted ? "Ativar som" : "Silenciar"}>
        <span aria-hidden="true">{volumeIcon(audio.volume, audio.muted)}</span>
      </button>
      <input
        type="range" min="0" max="100" step="1" value={Math.round(effective * 100)}
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
        aria-label="Volume do jogo" aria-valuetext={`${Math.round(effective * 100)}%`}
        style={{ "--volume-value": `${effective * 100}%` } as React.CSSProperties}
      />
      <output>{Math.round(effective * 100)}%</output>
    </div>
  );
}
