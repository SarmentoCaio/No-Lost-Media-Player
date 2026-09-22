import { useEffect, useState, type RefObject } from "react";
import type { EmulatorJSPlayerHandle } from "./EmulatorJSPlayer";
import { useGamepad } from "../hooks/useGamepad";
import {
  clearSaveDirectory,
  getBrowserSaveDirectory,
  getSave,
  getSaveDirectory,
  putSave,
  putSaveDirectory,
  requestPersistentStorage,
} from "../storage/saveStorage";
import type { Platform } from "../types/game";

interface DirectoryHandleWithPermission extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: FileSystemDirectoryHandle;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

interface PlayerToolbarProps {
  playerContainer: RefObject<HTMLDivElement | null>;
  emulatorRef: RefObject<EmulatorJSPlayerHandle | null>;
  gameId: string;
  platform: Platform;
  playerReady: boolean;
  n64Core?: string;
  onN64CoreChange?: (core: string) => void;
  onRestart: () => void;
  onError: (message: string) => void;
}

const N64_CORES = [
  { value: "mupen64plus_next", label: "N64: Mupen64" },
  { value: "parallel_n64", label: "N64: compatibilidade" },
];

export function PlayerToolbar({
  playerContainer,
  emulatorRef,
  gameId,
  platform,
  playerReady,
  n64Core,
  onN64CoreChange,
  onRestart,
  onError,
}: PlayerToolbarProps) {
  const gamepad = useGamepad();
  const [directory, setDirectory] = useState<DirectoryHandleWithPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSaveDirectory()
      .then((handle) => {
        if (active && handle) setDirectory(handle as DirectoryHandleWithPermission);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const selectDirectory = async () => {
    if (!window.showDirectoryPicker) {
      throw new Error("A seleção de pasta requer Chrome ou Edge em uma conexão HTTPS.");
    }
    const handle = await window.showDirectoryPicker({
      id: "no-lost-save-states",
      mode: "readwrite",
      ...(directory ? { startIn: directory } : {}),
    }) as DirectoryHandleWithPermission;
    await putSaveDirectory(handle);
    setDirectory(handle);
    setSaveMessage(`Pasta padrão: ${handle.name}`);
    return handle;
  };

  const ensureWritableDirectory = async () => {
    if (!directory) return null;
    const descriptor = { mode: "readwrite" as const };
    const currentPermission = directory.queryPermission
      ? await directory.queryPermission(descriptor)
      : "granted";
    if (currentPermission === "granted") return directory;
    const requestedPermission = directory.requestPermission
      ? await directory.requestPermission(descriptor)
      : "denied";
    if (requestedPermission !== "granted") {
      throw new Error("Permita o acesso à pasta de salvamentos para continuar.");
    }
    return directory;
  };

  const stateFileName = `${platform}-${gameId}.state`;

  const saveToBrowserStorage = async (state: ArrayBuffer) => {
    const browserDirectory = await getBrowserSaveDirectory();
    if (browserDirectory) {
      const fileHandle = await browserDirectory.getFileHandle(stateFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(state);
      await writable.close();
      await requestPersistentStorage().catch(() => false);
      return;
    }
    await putSave({ gameId, platform, saveData: state, updatedAt: new Date().toISOString() });
  };

  const loadFromBrowserStorage = async () => {
    const browserDirectory = await getBrowserSaveDirectory();
    if (browserDirectory) {
      const fileHandle = await browserDirectory.getFileHandle(stateFileName);
      return (await fileHandle.getFile()).arrayBuffer();
    }
    const record = await getSave(platform, gameId);
    if (!record) throw new DOMException("Save não encontrado", "NotFoundError");
    return record.saveData;
  };

  const saveGame = async () => {
    if (!emulatorRef.current) return;
    setBusy(true);
    setSaveMessage(null);
    try {
      const state = await emulatorRef.current.exportState();
      const targetDirectory = await ensureWritableDirectory();
      if (targetDirectory) {
        const fileHandle = await targetDirectory.getFileHandle(stateFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(state);
        await writable.close();
        setSaveMessage(`Salvo em ${targetDirectory.name}\\${stateFileName}`);
      } else {
        await saveToBrowserStorage(state);
        setSaveMessage(`Salvo automaticamente em No Lost Media Player/Saves`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onError(error instanceof Error ? error.message : "Não foi possível salvar o jogo.");
    } finally {
      setBusy(false);
    }
  };

  const loadGame = async () => {
    if (!emulatorRef.current) return;
    setBusy(true);
    setSaveMessage(null);
    try {
      const targetDirectory = await ensureWritableDirectory();
      if (targetDirectory) {
        const fileHandle = await targetDirectory.getFileHandle(stateFileName);
        const file = await fileHandle.getFile();
        await emulatorRef.current.importState(await file.arrayBuffer());
        setSaveMessage(`Carregado de ${targetDirectory.name}\\${stateFileName}`);
      } else {
        await emulatorRef.current.importState(await loadFromBrowserStorage());
        setSaveMessage(`Carregado de No Lost Media Player/Saves`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotFoundError") {
        onError(`Ainda não existe um salvamento para este jogo em ${directory?.name ?? "No Lost Media Player/Saves"}.`);
      } else {
        onError(error instanceof Error ? error.message : "Não foi possível carregar o jogo.");
      }
    } finally {
      setBusy(false);
    }
  };

  const openNetplay = async () => {
    if (!emulatorRef.current) return;
    setBusy(true);
    try {
      await emulatorRef.current.openNetplay();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível abrir as salas online.");
    } finally {
      setBusy(false);
    }
  };

  const openControls = async () => {
    if (!emulatorRef.current) return;
    try {
      await emulatorRef.current.openControls();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível abrir o mapeamento de controles.");
    }
  };

  const chooseDirectory = async () => {
    try {
      await selectDirectory();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onError(error instanceof Error ? error.message : "Não foi possível selecionar a pasta.");
    }
  };

  const useBrowserDirectory = async () => {
    try {
      await clearSaveDirectory();
      setDirectory(null);
      setSaveMessage("Pasta padrão restaurada: armazenamento local do navegador");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível restaurar a pasta padrão.");
    }
  };

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
      <div className="toolbar-statuses">
        <div className={`gamepad-status${gamepad ? " gamepad-status--connected" : ""}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>{gamepad ? `${gamepad.id} conectado` : "Nenhum controle conectado"}</span>
        </div>
        <span className="save-directory-status" title={saveMessage ?? undefined}>
          {saveMessage ?? (directory
            ? `Saves em: ${directory.name}`
            : "Saves automáticos: No Lost Media Player/Saves (armazenamento do navegador)")}
        </span>
      </div>
      <div className="toolbar-actions">
        {platform === "n64" && n64Core && onN64CoreChange && (
          <select
            className="toolbar-select"
            value={n64Core}
            onChange={(event) => onN64CoreChange(event.target.value)}
            aria-label="Núcleo do emulador Nintendo 64"
          >
            {N64_CORES.map((core) => <option key={core.value} value={core.value}>{core.label}</option>)}
          </select>
        )}
        <button
          type="button"
          className="toolbar-button toolbar-button--online"
          onClick={openNetplay}
          disabled={!playerReady || busy}
          title="Crie uma sala ou entre na sala de outro jogador"
        >
          Jogar online
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={openControls}
          disabled={!playerReady || busy}
          title="Configure as teclas e os controles de cada jogador"
        >
          Controles
        </button>
        <button type="button" className="toolbar-button" onClick={chooseDirectory} disabled={busy}>
          Pasta de saves
        </button>
        {directory && (
          <button type="button" className="toolbar-button toolbar-button--quiet" onClick={useBrowserDirectory} disabled={busy}>
            Usar padrão
          </button>
        )}
        <button type="button" className="toolbar-button" onClick={saveGame} disabled={!playerReady || busy}>
          Salvar
        </button>
        <button type="button" className="toolbar-button" onClick={loadGame} disabled={!playerReady || busy}>
          Carregar
        </button>
        <button
          type="button"
          className="toolbar-button toolbar-button--restart"
          onClick={onRestart}
          disabled={busy}
          title="Encerra e inicia novamente a emulação deste jogo"
        >
          Reiniciar
        </button>
        <button type="button" className="toolbar-button toolbar-button--primary" onClick={enterFullscreen}>
          <span aria-hidden="true">⛶</span> Tela cheia
        </button>
      </div>
    </div>
  );
}
