import { DEFAULT_UNIVERSE_THEME, UNIVERSE_THEMES } from "./universe-themes.js";

const STORAGE_KEYS = {
  notes: "solar-notes:v1",
  categories: "solar-notes:categories:v1",
  tasks: "solar-notes:tasks:v1",
  events: "solar-notes:calendar-events:v1",
  folders: "solar-notes:folders:v1"
};
const UNIVERSES_STORAGE_KEY = "solar-notes:universes:v1";
const ACTIVE_UNIVERSE_STORAGE_KEY = "solar-notes:active-universe:v1";
const DATA_FIELDS = Object.keys(STORAGE_KEYS);

let saveToServer;
let saveTimer;
let saveQueue = Promise.resolve();

function emptyUniverseData() {
  return Object.fromEntries(DATA_FIELDS.map((field) => [field, []]));
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `universe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeUniverseData(data, source = "Universumsdata") {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError(`${source} har ett ogiltigt format.`);
  }
  const normalized = {};
  for (const field of DATA_FIELDS) {
    const value = data[field];
    if (field === "folders" && value === undefined) {
      normalized[field] = [];
    } else if (!Array.isArray(value)) {
      throw new TypeError(`${source}: ${field}-data måste vara en lista.`);
    } else {
      normalized[field] = value;
    }
  }
  return normalized;
}

function normalizeUniverse(universe, index) {
  if (!universe || typeof universe !== "object" || Array.isArray(universe)) {
    throw new TypeError(`Universum ${index + 1} har ett ogiltigt format.`);
  }
  const id = typeof universe.id === "string" ? universe.id.trim() : "";
  const name = typeof universe.name === "string" ? universe.name.trim() : "";
  const theme = typeof universe.theme === "string" ? universe.theme : DEFAULT_UNIVERSE_THEME;
  if (!id || !name || name.length > 40) {
    throw new TypeError(`Universum ${index + 1} måste ha ett id och ett namn på högst 40 tecken.`);
  }
  if (!Object.hasOwn(UNIVERSE_THEMES, theme)) {
    throw new TypeError(`Universum ${name} har ett okänt tema.`);
  }
  return {
    id,
    name,
    theme,
    data: universe.data === undefined
      ? emptyUniverseData()
      : normalizeUniverseData(universe.data, `Universum ${name}`)
  };
}

function readUniverseIndex(currentData) {
  const stored = localStorage.getItem(UNIVERSES_STORAGE_KEY);
  let universes;
  if (stored === null) {
    universes = [{
      id: "universe-main",
      name: "Mitt universum",
      theme: DEFAULT_UNIVERSE_THEME,
      data: currentData || emptyUniverseData()
    }];
  } else {
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      throw new Error("Universumlistan innehåller ogiltig JSON.", { cause: error });
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new TypeError("Universumlistan måste innehålla minst ett universum.");
    }
    universes = parsed.map(normalizeUniverse);
  }

  const activeUniverseId = localStorage.getItem(ACTIVE_UNIVERSE_STORAGE_KEY) || universes[0].id;
  const activeUniverse = universes.find((universe) => universe.id === activeUniverseId);
  if (!activeUniverse) {
    throw new TypeError("Det valda universumet finns inte i universumlistan.");
  }
  const activeData = currentData || activeUniverse.data;
  const syncedUniverses = universes.map((universe) =>
    universe.id === activeUniverseId ? { ...universe, data: activeData } : universe
  );
  return { universes: syncedUniverses, activeUniverseId, data: activeData };
}

function writeCurrentData(data) {
  const normalized = normalizeUniverseData(data, "Aktivt universum");
  for (const [field, key] of Object.entries(STORAGE_KEYS)) {
    localStorage.setItem(key, JSON.stringify(normalized[field]));
  }
}

function writeUniverseIndex(universes, activeUniverseId) {
  localStorage.setItem(UNIVERSES_STORAGE_KEY, JSON.stringify(universes));
  localStorage.setItem(ACTIVE_UNIVERSE_STORAGE_KEY, activeUniverseId);
}

function readStoredValue(key, fallback) {
  const stored = localStorage.getItem(key);
  return stored === null ? fallback : JSON.parse(stored);
}

export function readLocalData() {
  const notes = localStorage.getItem(STORAGE_KEYS.notes);
  const currentData = notes === null ? null : normalizeUniverseData({
    notes: JSON.parse(notes),
    categories: readStoredValue(STORAGE_KEYS.categories, []),
    tasks: readStoredValue(STORAGE_KEYS.tasks, []),
    events: readStoredValue(STORAGE_KEYS.events, []),
    folders: readStoredValue(STORAGE_KEYS.folders, [])
  }, "Lokala data");
  if (currentData === null && localStorage.getItem(UNIVERSES_STORAGE_KEY) === null) return null;
  const state = readUniverseIndex(currentData);
  return {
    ...state.data,
    universes: state.universes,
    activeUniverseId: state.activeUniverseId
  };
}

export function hydrateLocalData(data) {
  const currentData = normalizeUniverseData(data, "Serverns sparade data");
  let universes = data.universes === undefined
    ? [{
        id: "universe-main",
        name: "Mitt universum",
        theme: DEFAULT_UNIVERSE_THEME,
        data: currentData
      }]
    : data.universes.map(normalizeUniverse);
  if (universes.length === 0) {
    throw new TypeError("Serverns universumlista måste innehålla minst ett universum.");
  }
  const activeUniverseId = typeof data.activeUniverseId === "string"
    ? data.activeUniverseId
    : universes[0].id;
  if (!universes.some((universe) => universe.id === activeUniverseId)) {
    throw new TypeError("Serverns aktiva universum finns inte i universumlistan.");
  }
  universes = universes.map((universe) =>
    universe.id === activeUniverseId ? { ...universe, data: currentData } : universe
  );
  writeCurrentData(currentData);
  writeUniverseIndex(universes, activeUniverseId);
}

export function loadUniverseState() {
  let data = readLocalData();
  if (data === null) {
    const empty = emptyUniverseData();
    const universe = {
      id: createId(),
      name: "Mitt universum",
      theme: DEFAULT_UNIVERSE_THEME,
      data: empty
    };
    data = {
      ...empty,
      universes: [universe],
      activeUniverseId: universe.id
    };
  }
  writeCurrentData(data);
  writeUniverseIndex(data.universes, data.activeUniverseId);
  return data;
}

export function switchUniverse(id) {
  const state = loadUniverseState();
  const universe = state.universes.find((item) => item.id === id);
  if (!universe) throw new Error("Det valda universumet kunde inte hittas.");
  if (id === state.activeUniverseId) return state;
  writeCurrentData(universe.data);
  writeUniverseIndex(state.universes, id);
  scheduleRemoteSave();
  return {
    ...universe.data,
    universes: state.universes,
    activeUniverseId: id
  };
}

export function createUniverse(name, theme = DEFAULT_UNIVERSE_THEME) {
  const state = loadUniverseState();
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName || normalizedName.length > 40) {
    throw new TypeError("Universumets namn måste vara mellan 1 och 40 tecken.");
  }
  if (state.universes.some((item) => item.name.toLocaleLowerCase("sv") === normalizedName.toLocaleLowerCase("sv"))) {
    throw new Error("Ett universum med det namnet finns redan.");
  }
  if (!Object.hasOwn(UNIVERSE_THEMES, theme)) {
    throw new TypeError("Välj ett av de tillgängliga universumtemana.");
  }
  const empty = emptyUniverseData();
  const universe = { id: createId(), name: normalizedName, theme, data: empty };
  const universes = [...state.universes, universe];
  writeCurrentData(empty);
  writeUniverseIndex(universes, universe.id);
  scheduleRemoteSave();
  return {
    ...empty,
    universes,
    activeUniverseId: universe.id
  };
}

export function updateUniverse(id, updates) {
  const state = loadUniverseState();
  const existing = state.universes.find((item) => item.id === id);
  if (!existing) throw new Error("Universumet kunde inte hittas.");
  const name = updates.name === undefined ? existing.name : updates.name.trim();
  const theme = updates.theme === undefined ? existing.theme : updates.theme;
  if (!name || name.length > 40) {
    throw new TypeError("Universumets namn måste vara mellan 1 och 40 tecken.");
  }
  if (state.universes.some((item) => item.id !== id && item.name.toLocaleLowerCase("sv") === name.toLocaleLowerCase("sv"))) {
    throw new Error("Ett universum med det namnet finns redan.");
  }
  if (!Object.hasOwn(UNIVERSE_THEMES, theme)) {
    throw new TypeError("Välj ett av de tillgängliga universumtemana.");
  }
  const universes = state.universes.map((item) =>
    item.id === id ? { ...item, name, theme } : item
  );
  writeUniverseIndex(universes, state.activeUniverseId);
  scheduleRemoteSave();
  return { ...state, universes };
}

export function configurePersistence(adapter) {
  saveToServer = adapter;
  window.addEventListener("pagehide", flushRemoteSave);
  window.addEventListener("online", scheduleRemoteSave);
}

function queueRemoteSave(keepalive = false) {
  if (!saveToServer) return Promise.resolve();
  let data;
  try {
    data = readLocalData();
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent("solar-notes:persistence-error", {
        detail: { message: error.message || "Kunde inte läsa data inför molnsparning." }
      })
    );
    return Promise.resolve();
  }
  if (!data) return Promise.resolve();

  saveQueue = saveQueue
    .then(() => saveToServer(data, { keepalive }))
    .catch((error) => {
      const event = new CustomEvent("solar-notes:persistence-error", {
        detail: { message: error.message || "Kunde inte spara dina data på servern." }
      });
      window.dispatchEvent(event);
    });
  return saveQueue;
}

export function scheduleRemoteSave() {
  if (!saveToServer) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void queueRemoteSave();
  }, 150);
}

function flushRemoteSave() {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  void queueRemoteSave(true);
}
