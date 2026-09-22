import type { ConsoleControlConfig, GamepadBinding, MobileElementSettings, PlayablePlatform } from "./controlTypes";

const button = (index: number): GamepadBinding => ({ type: "button", index });
const axis = (index: number, direction: -1 | 1): GamepadBinding => ({ type: "axis", index, direction });
const control = (
  id: string,
  label: string,
  shortLabel: string,
  coreIndex: number,
  keyboard: string,
  gamepad: GamepadBinding,
  x: number,
  y: number,
  kind: "button" | "dpad" | "analog" = "button",
) => ({ id, label, shortLabel, coreIndex, keyboard, gamepad, visual: { x, y }, kind });

const directions = [
  control("up", "Cima", "↑", 4, "ArrowUp", button(12), 22, 39, "dpad"),
  control("down", "Baixo", "↓", 5, "ArrowDown", button(13), 22, 61, "dpad"),
  control("left", "Esquerda", "←", 6, "ArrowLeft", button(14), 14, 50, "dpad"),
  control("right", "Direita", "→", 7, "ArrowRight", button(15), 30, 50, "dpad"),
];

export const consoleMappings: Record<PlayablePlatform, ConsoleControlConfig> = {
  nes: {
    platform: "nes", name: "NES", shape: "rectangle", analogs: [],
    controls: [
      ...directions,
      control("b", "B", "B", 0, "KeyX", button(2), 69, 55),
      control("a", "A", "A", 8, "KeyZ", button(0), 82, 49),
      control("select", "Select", "SELECT", 2, "ShiftRight", button(8), 43, 68),
      control("start", "Start", "START", 3, "Enter", button(9), 56, 68),
    ],
  },
  snes: {
    platform: "snes", name: "Super Nintendo", shape: "rounded", analogs: [],
    controls: [
      ...directions,
      control("y", "Y", "Y", 1, "KeyA", button(2), 72, 50),
      control("b", "B", "B", 0, "KeyZ", button(0), 80, 61),
      control("x", "X", "X", 9, "KeyS", button(3), 80, 39),
      control("a", "A", "A", 8, "KeyX", button(1), 88, 50),
      control("l", "L", "L", 10, "KeyQ", button(4), 22, 15),
      control("r", "R", "R", 11, "KeyW", button(5), 78, 15),
      control("select", "Select", "SELECT", 2, "ShiftRight", button(8), 44, 68),
      control("start", "Start", "START", 3, "Enter", button(9), 57, 68),
    ],
  },
  gba: {
    platform: "gba", name: "Game Boy Advance", shape: "handheld", analogs: [],
    controls: [
      ...directions,
      control("b", "B", "B", 0, "KeyZ", button(2), 75, 57),
      control("a", "A", "A", 8, "KeyX", button(0), 86, 48),
      control("l", "L", "L", 10, "KeyQ", button(4), 18, 15),
      control("r", "R", "R", 11, "KeyW", button(5), 82, 15),
      control("select", "Select", "SELECT", 2, "ShiftRight", button(8), 45, 73),
      control("start", "Start", "START", 3, "Enter", button(9), 58, 73),
    ],
  },
  n64: {
    platform: "n64", name: "Nintendo 64", shape: "trident",
    analogs: [{ id: "left-stick", label: "Analógico", up: "stick-up", down: "stick-down", left: "stick-left", right: "stick-right", visual: { x: 50, y: 59 } }],
    controls: [
      ...directions.map((item) => ({ ...item, visual: { x: item.visual.x - 4, y: item.visual.y + 2 } })),
      control("a", "A", "A", 0, "KeyX", button(0), 76, 59),
      control("b", "B", "B", 1, "KeyZ", button(2), 68, 48),
      control("c-up", "C cima", "C↑", 23, "KeyI", axis(3, -1), 86, 35),
      control("c-down", "C baixo", "C↓", 22, "KeyK", axis(3, 1), 86, 55),
      control("c-left", "C esquerda", "C←", 21, "KeyJ", axis(2, -1), 80, 45),
      control("c-right", "C direita", "C→", 20, "KeyL", axis(2, 1), 92, 45),
      control("l", "L", "L", 10, "KeyQ", button(4), 23, 14),
      control("r", "R", "R", 11, "KeyE", button(5), 77, 14),
      control("z", "Z", "Z", 12, "KeyC", button(6), 50, 80),
      control("start", "Start", "START", 3, "Enter", button(9), 50, 39),
      control("stick-up", "Analógico cima", "↑", 19, "KeyW", axis(1, -1), 50, 53, "analog"),
      control("stick-down", "Analógico baixo", "↓", 18, "KeyS", axis(1, 1), 50, 65, "analog"),
      control("stick-left", "Analógico esquerda", "←", 17, "KeyA", axis(0, -1), 45, 59, "analog"),
      control("stick-right", "Analógico direita", "→", 16, "KeyD", axis(0, 1), 55, 59, "analog"),
    ],
  },
  ps1: {
    platform: "ps1", name: "PlayStation", shape: "dual-grip",
    analogs: [
      { id: "left-stick", label: "Analógico esquerdo", up: "left-stick-up", down: "left-stick-down", left: "left-stick-left", right: "left-stick-right", visual: { x: 42, y: 67 } },
      { id: "right-stick", label: "Analógico direito", up: "right-stick-up", down: "right-stick-down", left: "right-stick-left", right: "right-stick-right", visual: { x: 59, y: 67 } },
    ],
    controls: [
      ...directions,
      control("triangle", "Triângulo", "△", 9, "KeyS", button(3), 83, 37),
      control("circle", "Círculo", "○", 8, "KeyC", button(1), 90, 48),
      control("cross", "Cruz", "×", 0, "KeyX", button(0), 83, 59),
      control("square", "Quadrado", "□", 1, "KeyZ", button(2), 76, 48),
      control("l1", "L1", "L1", 10, "KeyQ", button(4), 22, 13),
      control("l2", "L2", "L2", 12, "Digit1", button(6), 22, 7),
      control("r1", "R1", "R1", 11, "KeyE", button(5), 78, 13),
      control("r2", "R2", "R2", 13, "Digit3", button(7), 78, 7),
      control("select", "Select", "SELECT", 2, "ShiftRight", button(8), 44, 46),
      control("start", "Start", "START", 3, "Enter", button(9), 57, 46),
      control("left-stick-up", "Analógico E cima", "↑", 19, "KeyW", axis(1, -1), 42, 62, "analog"),
      control("left-stick-down", "Analógico E baixo", "↓", 18, "KeyS", axis(1, 1), 42, 72, "analog"),
      control("left-stick-left", "Analógico E esquerda", "←", 17, "KeyA", axis(0, -1), 38, 67, "analog"),
      control("left-stick-right", "Analógico E direita", "→", 16, "KeyD", axis(0, 1), 46, 67, "analog"),
      control("right-stick-up", "Analógico D cima", "↑", 23, "KeyI", axis(3, -1), 59, 62, "analog"),
      control("right-stick-down", "Analógico D baixo", "↓", 22, "KeyK", axis(3, 1), 59, 72, "analog"),
      control("right-stick-left", "Analógico D esquerda", "←", 21, "KeyJ", axis(2, -1), 55, 67, "analog"),
      control("right-stick-right", "Analógico D direita", "→", 20, "KeyL", axis(2, 1), 63, 67, "analog"),
    ],
  },
};

export function defaultMobileSettings(platform: PlayablePlatform): Record<string, MobileElementSettings> {
  const config = consoleMappings[platform];
  const result: Record<string, MobileElementSettings> = {
    dpad: { x: config.analogs.length ? 12 : 17, y: config.analogs.length ? 52 : 73, size: 1, opacity: 0.72, visible: true },
  };
  for (const analog of config.analogs) {
    result[analog.id] = {
      x: analog.id === "left-stick" ? 24 : 66,
      y: 77,
      size: 1,
      opacity: 0.72,
      visible: true,
    };
  }
  const buttons = config.controls.filter((item) => item.kind === "button");
  buttons.forEach((item) => {
    let x = item.visual.x;
    let y = item.visual.y;
    if (["start", "select"].includes(item.id)) y = 88;
    else if (["l", "l1", "l2"].includes(item.id)) { x = 12; y = item.id.endsWith("2") ? 8 : 16; }
    else if (["r", "r1", "r2"].includes(item.id)) { x = 88; y = item.id.endsWith("2") ? 8 : 16; }
    else if (x > 60) { x = Math.min(88, x + 1); y = Math.min(80, y + 18); }
    result[item.id] = { x, y, size: ["start", "select"].includes(item.id) ? 0.72 : 1, opacity: 0.72, visible: true };
  });
  return result;
}

export const playablePlatforms = Object.keys(consoleMappings) as PlayablePlatform[];

export function formatKey(code: string): string {
  const aliases: Record<string, string> = {
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    ShiftLeft: "Shift E", ShiftRight: "Shift D", ControlLeft: "Ctrl E", ControlRight: "Ctrl D",
    Enter: "Enter", Space: "Espaço", Escape: "Esc",
  };
  return aliases[code] ?? code.replace(/^Key/, "").replace(/^Digit/, "");
}

export function formatGamepad(binding: GamepadBinding): string {
  return binding.type === "button"
    ? `Botão ${binding.index}`
    : `Eixo ${binding.index} ${binding.direction > 0 ? "+" : "−"}`;
}
