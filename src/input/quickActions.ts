import type { QuickActionId } from "./controlTypes";

export interface QuickActionDefinition {
  id: QuickActionId;
  label: string;
  shortLabel: string;
  description: string;
  hold?: boolean;
}

export const quickActions: QuickActionDefinition[] = [
  { id: "fastForward", label: "Avanço rápido", shortLabel: "2×", description: "Segure para acelerar o jogo", hold: true },
  { id: "save", label: "Salvar estado", shortLabel: "SAVE", description: "Cria um salvamento instantâneo" },
  { id: "load", label: "Carregar estado", shortLabel: "LOAD", description: "Retoma o último estado salvo" },
  { id: "pause", label: "Pausar / continuar", shortLabel: "P", description: "Alterna a pausa da emulação" },
  { id: "mute", label: "Ativar / silenciar áudio", shortLabel: "VOL", description: "Alterna o som do jogo" },
  { id: "fullscreen", label: "Alternar tela cheia", shortLabel: "⛶", description: "Entra ou sai da tela cheia" },
];
