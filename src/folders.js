import { scheduleRemoteSave } from "./persistence.js";

const STORAGE_KEY = "solar-notes:folders:v1";

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeFolder(folder, index = 0) {
  if (!folder || typeof folder !== "object" || Array.isArray(folder)) {
    throw new TypeError(`Mapp ${index + 1} har ett ogiltigt format.`);
  }
  const name = typeof folder.name === "string" ? folder.name.trim() : "";
  if (!name) throw new TypeError(`Mapp ${index + 1} måste ha ett namn.`);
  return {
    id: typeof folder.id === "string" && folder.id ? folder.id : createId(),
    planetId: typeof folder.planetId === "string" ? folder.planetId : "",
    name,
    sortOrder: Number.isFinite(folder.sortOrder) ? folder.sortOrder : index,
    createdAt: typeof folder.createdAt === "string" ? folder.createdAt : new Date().toISOString(),
    updatedAt: typeof folder.updatedAt === "string" ? folder.updatedAt : new Date().toISOString()
  };
}

export function loadFolders() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new TypeError("Mapparnas sparade data måste vara en lista.");
    return parsed.map(normalizeFolder);
  } catch (error) {
    throw new Error(error.message || "Kunde inte läsa mapparnas sparade data.", { cause: error });
  }
}

export function persistFolders(folders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders.map(normalizeFolder)));
    scheduleRemoteSave();
  } catch (error) {
    throw new Error("Kunde inte spara mapparna i webbläsaren.", { cause: error });
  }
}

export function createFolder(folders, input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new TypeError("Mappen måste ha ett namn.");
  const siblings = folders.filter((folder) => folder.planetId === input.planetId);
  if (siblings.some((folder) => folder.name.toLocaleLowerCase("sv") === name.toLocaleLowerCase("sv"))) {
    throw new Error("Det finns redan en mapp med det namnet på denna planet.");
  }
  return [...folders, normalizeFolder({
    id: createId(),
    planetId: input.planetId,
    name,
    sortOrder: siblings.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })];
}

export function updateFolder(folders, id, updates) {
  return folders.map((folder) =>
    folder.id === id
      ? normalizeFolder({ ...folder, ...updates, updatedAt: new Date().toISOString() })
      : folder
  );
}

export function deleteFolder(folders, id) {
  return folders.filter((folder) => folder.id !== id);
}
