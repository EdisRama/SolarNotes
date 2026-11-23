const STORAGE_KEYS = {
  notes: "solar-notes:v1",
  categories: "solar-notes:categories:v1",
  tasks: "solar-notes:tasks:v1",
  events: "solar-notes:calendar-events:v1"
};

let saveToServer;
let saveTimer;
let saveQueue = Promise.resolve();

function readStoredValue(key, fallback) {
  const stored = localStorage.getItem(key);
  return stored === null ? fallback : JSON.parse(stored);
}

export function readLocalData() {
  const notes = localStorage.getItem(STORAGE_KEYS.notes);
  if (notes === null) return null;
  return {
    notes: JSON.parse(notes),
    categories: readStoredValue(STORAGE_KEYS.categories, []),
    tasks: readStoredValue(STORAGE_KEYS.tasks, []),
    events: readStoredValue(STORAGE_KEYS.events, [])
  };
}

export function hydrateLocalData(data) {
  for (const [name, key] of Object.entries(STORAGE_KEYS)) {
    const value = data[name];
    if (!Array.isArray(value)) {
      throw new TypeError(`Serverns sparade ${name}-data har ett ogiltigt format.`);
    }
    localStorage.setItem(key, JSON.stringify(value));
  }
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
