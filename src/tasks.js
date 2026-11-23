import { scheduleRemoteSave } from "./persistence.js";

const STORAGE_KEY = "solar-notes:tasks:v1";

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeTask(task, index = 0) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    throw new TypeError(`Uppgift ${index + 1} har ett ogiltigt format.`);
  }
  const title = typeof task.title === "string" ? task.title.trim() : "";
  if (!title) throw new TypeError(`Uppgift ${index + 1} saknar titel.`);
  const dueDate = typeof task.dueDate === "string" ? task.dueDate : "";
  if (dueDate && !isValidDateKey(dueDate)) {
    throw new TypeError(`Uppgift ${index + 1} har ett ogiltigt förfallodatum.`);
  }
  return {
    id: typeof task.id === "string" && task.id ? task.id : createId(),
    title,
    dueDate,
    done: task.done === true,
    createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    updatedAt: typeof task.updatedAt === "string" ? task.updatedAt : new Date().toISOString()
  };
}

export function loadTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new Error("Uppgifternas sparade data innehåller ogiltig JSON.", { cause: error });
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError("Uppgifternas sparade data måste vara en lista.");
  }
  return parsed.map(normalizeTask);
}

export function persistTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    scheduleRemoteSave();
  } catch (error) {
    throw new Error("Kunde inte spara uppgifterna i webbläsaren.", { cause: error });
  }
}

export function createTask(input) {
  return normalizeTask({
    id: createId(),
    title: input.title,
    dueDate: input.dueDate || "",
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function mergeTasks(current, imported) {
  if (!Array.isArray(imported)) {
    throw new TypeError("Importfilens uppgifter måste vara en lista.");
  }
  const merged = new Map(current.map((task) => [task.id, task]));
  imported.map(normalizeTask).forEach((task) => merged.set(task.id, task));
  return Array.from(merged.values());
}
