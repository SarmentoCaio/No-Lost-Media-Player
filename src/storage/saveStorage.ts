import type { Platform } from "../types/game";

export interface SaveRecord {
  gameId: string;
  platform: Platform;
  saveData: ArrayBuffer;
  updatedAt: string;
}

const DATABASE_NAME = "no-lost-media-player";
const DATABASE_VERSION = 2;
const STORE_NAME = "saves";
const SETTINGS_STORE_NAME = "settings";
const SAVE_DIRECTORY_KEY = "save-directory";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o IndexedDB."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: ["platform", "gameId"] });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao acessar o salvamento."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Operação de salvamento cancelada."));
  });
}

export async function putSave(record: SaveRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(record);
  await transactionDone(transaction);
  database.close();
}

export async function getSave(platform: Platform, gameId: string): Promise<SaveRecord | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).get([platform, gameId]);
  const result = await new Promise<SaveRecord | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as SaveRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("Falha ao ler o salvamento."));
  });
  database.close();
  return result;
}

export async function deleteSave(platform: Platform, gameId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete([platform, gameId]);
  await transactionDone(transaction);
  database.close();
}

export async function putSaveDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
  transaction.objectStore(SETTINGS_STORE_NAME).put(handle, SAVE_DIRECTORY_KEY);
  await transactionDone(transaction);
  database.close();
}

export async function getSaveDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE_NAME, "readonly");
  const request = transaction.objectStore(SETTINGS_STORE_NAME).get(SAVE_DIRECTORY_KEY);
  const result = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle | undefined);
    request.onerror = () => reject(request.error ?? new Error("Falha ao ler a pasta de salvamentos."));
  });
  database.close();
  return result;
}

export async function clearSaveDirectory(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
  transaction.objectStore(SETTINGS_STORE_NAME).delete(SAVE_DIRECTORY_KEY);
  await transactionDone(transaction);
  database.close();
}

/**
 * Retorna a pasta privada padrão do site (OPFS). No Chrome/Edge ela fica
 * fisicamente dentro do perfil do navegador, normalmente sob AppData, mas
 * sem expor um caminho do sistema operacional nem pedir permissão ao usuário.
 */
export async function getBrowserSaveDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (!storage.getDirectory) return undefined;
  const root = await storage.getDirectory();
  const appDirectory = await root.getDirectoryHandle("No Lost Media Player", { create: true });
  return appDirectory.getDirectoryHandle("Saves", { create: true });
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
