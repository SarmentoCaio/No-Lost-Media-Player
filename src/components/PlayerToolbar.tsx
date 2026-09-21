import type { RefObject } from "react";
import { useGamepad } from "../hooks/useGamepad";

interface PlayerToolbarProps {
  playerContainer: RefObject<HTMLDivElement | null>;
  onError: (message: string) => void;
}

export function PlayerToolbar({ playerContainer, onError }: PlayerToolbarProps) {
  const gamepad = useGamepad();

  const enterFullscreen = async () => {
    const element = playerContainer.current;
    if (!element) return;
    try {
      await element.requestFullscreen();
    } catch {
      onError("O navegador não permitiu entrar em tela cheia.");
    }
  };

  return (
    <div className="player-toolbar">
      <div className={`gamepad-status${gamepad ? " gamepad-status--connected" : ""}`}>
        <span className="status-dot" aria-hidden="true" />
        <span>{gamepad ? `${gamepad.id} conectado` : "Nenhum controle conectado"}</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="toolbar-button" disabled title="Disponível pelo menu do EmulatorJS">
          Salvar
        </button>
        <button type="button" className="toolbar-button" disabled title="Disponível pelo menu do EmulatorJS">
          Carregar
        </button>
        <button type="button" className="toolbar-button toolbar-button--primary" onClick={enterFullscreen}>
          <span aria-hidden="true">⛶</span> Tela cheia
        </button>
      </div>
    </div>
  );
}
