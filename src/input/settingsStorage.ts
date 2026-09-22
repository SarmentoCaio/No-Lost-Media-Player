import { consoleMappings, defaultMobileSettings } from "./consoleMappings";
import type { AudioSettings, GamepadBinding, PlatformControlSettings, PlayablePlatform } from "./controlTypes";

const STORAGE_KEY = "no-lost-media.settings.v2";

interface StoredSettings {
  version: 2;
  audio: AudioSettings;
  controls: Partial<Record<PlayablePlatform, Partial<PlatformControlSettings>>>;
}

const defaultAudio: AudioSettings = { volume: 0.8, muted: false, previousVolume: 0.8 };

function readSettings(): StoredSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<StoredSettings> | null;
    if (parsed?.version === 2) {
      return { version: 2, audio: { ...defaultAudio, ...parsed.audio }, controls: parsed.controls ?? {} };
    }
  } catch {
    // Configuração inválida ou armazenamento indisponível: usa padrões seguros.
  }
  return { version: 2, audio: defaultAudio, controls: {} };
}

function writeSettings(settings: StoredSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // A aplicação continua funcional em navegação privada/armazenamento bloqueado.
  }
}

export function createDefaultControlSettings(platform: PlayablePlatform): PlatformControlSettings {
  const controls = consoleMappings[platform].controls;
  return {
    keyboard: Object.fromEntries(controls.map((item) => [item.id, item.keyboard])),
    gamepad: Object.fromEntries(controls.map((item) => [item.id, item.gamepad])),
    mobile: defaultMobileSettings(platform),
  };
}

export function loadControlSettings(platform: PlayablePlatform): PlatformControlSettings {
  const defaults = createDefaultControlSettings(platform);
  const stored = readSettings().controls[platform];
  return {
    keyboard: { ...defaults.keyboard, ...stored?.keyboard },
    gamepad: { ...defaults.gamepad, ...stored?.gamepad } as Record<string, GamepadBinding>,
    mobile: { ...defaults.mobile, ...stored?.mobile },
  };
}

export function saveControlSettings(platform: PlayablePlatform, value: PlatformControlSettings) {
  const settings = readSettings();
  settings.controls[platform] = value;
  writeSettings(settings);
}

export function resetControlSettings(platform: PlayablePlatform): PlatformControlSettings {
  const value = createDefaultControlSettings(platform);
  const settings = readSettings();
  settings.controls[platform] = value;
  writeSettings(settings);
  return value;
}

export function loadAudioSettings(): AudioSettings {
  const audio = readSettings().audio;
  const volume = Math.min(1, Math.max(0, Number(audio.volume) || 0));
  const previousVolume = Math.min(1, Math.max(0.01, Number(audio.previousVolume) || 0.8));
  return { volume, previousVolume, muted: Boolean(audio.muted) };
}

export function saveAudioSettings(audio: AudioSettings) {
  const settings = readSettings();
  settings.audio = audio;
  writeSettings(settings);
}
