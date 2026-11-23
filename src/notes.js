import { scheduleRemoteSave } from "./persistence.js";

const STORAGE_KEY = "solar-notes:v1";
const CATEGORY_STORAGE_KEY = "solar-notes:categories:v1";
const DEFAULT_SYSTEM_ID = "personal";
const DEFAULT_CATEGORIES = [
  "Programming",
  "JavaScript",
  "History",
  "School",
  "Science",
  "Mathematics",
  "Personal",
  "Ideas",
  "Work",
  "Projects",
  "Other"
];

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNote(note, index = 0) {
  if (!note || typeof note !== "object" || Array.isArray(note)) {
    throw new TypeError(`Anteckning ${index + 1} har ett ogiltigt format.`);
  }

  const title = typeof note.title === "string" ? note.title.trim() : "";
  const category = typeof note.category === "string" ? note.category.trim() : "";
  const content = typeof note.content === "string" ? note.content.trim() : "";

  if (!title || !category || !content) {
    throw new TypeError(`Anteckning ${index + 1} måste ha titel, kategori och innehåll.`);
  }

  const createdAt = typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString();
  return {
    id: typeof note.id === "string" && note.id ? note.id : createId(),
    title,
    category,
    content,
    tags: Array.isArray(note.tags) ? note.tags.filter((tag) => typeof tag === "string") : [],
    importance: Number.isInteger(note.importance)
      ? Math.min(3, Math.max(1, note.importance))
      : 2,
    favorite: note.favorite === true,
    archived: note.archived === true,
    relatedIds: Array.isArray(note.relatedIds)
      ? note.relatedIds.filter((id) => typeof id === "string")
      : [],
    moons: Array.isArray(note.moons) ? note.moons : [],
    planetId: typeof note.planetId === "string" ? note.planetId : "",
    folderId: typeof note.folderId === "string" ? note.folderId : "",
    date: typeof note.date === "string" ? note.date : "",
    systemId: typeof note.systemId === "string" ? note.systemId : DEFAULT_SYSTEM_ID,
    source: typeof note.source === "string" ? note.source : "manual",
    createdAt,
    updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : createdAt
  };
}

function save(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    scheduleRemoteSave();
  } catch (error) {
    throw new Error("Kunde inte spara anteckningarna i webbläsarens lokala lagring.", {
      cause: error
    });
  }
}

export async function loadNotes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      throw new Error("Den sparade anteckningsfilen innehåller ogiltig JSON.", { cause: error });
    }

    if (!Array.isArray(parsed)) {
      throw new TypeError("Den sparade anteckningsfilen måste vara en lista.");
    }

    return parsed.map(normalizeNote);
  }

  const response = await fetch(`${import.meta.env.BASE_URL}notes.json`);
  if (!response.ok) {
    throw new Error(`Kunde inte läsa exempelanteckningarna (HTTP ${response.status}).`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new TypeError("public/notes.json måste innehålla en lista med anteckningar.");
  }

  const notes = data.map(normalizeNote);
  save(notes);
  return notes;
}

export function createNote(input) {
  const note = normalizeNote({
    ...input,
    id: createId(),
    tags: Array.isArray(input.tags) ? input.tags : [],
    relatedIds: [],
    moons: [],
    favorite: false,
    archived: false,
    systemId: DEFAULT_SYSTEM_ID,
    source: "manual",
    createdAt: new Date().toISOString()
  });

  return note;
}

export function persistNotes(notes) {
  save(notes);
}

export function updateNote(notes, id, updates) {
  const updatedAt = new Date().toISOString();
  return notes.map((note) =>
    note.id === id ? normalizeNote({ ...note, ...updates, updatedAt }) : note
  );
}

export function loadCategories(notes) {
  const stored = localStorage.getItem(CATEGORY_STORAGE_KEY);
  let categories = DEFAULT_CATEGORIES.map((name) => ({ name }));
  if (stored !== null) {
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      throw new Error("Kategoriernas sparade data innehåller ogiltig JSON.", { cause: error });
    }
    if (!Array.isArray(parsed)) {
      throw new TypeError("Kategoriernas sparade data måste vara en lista.");
    }
    categories = parsed
      .filter((category) => category && typeof category.name === "string" && category.name.trim())
      .map((category) => ({ name: category.name.trim() }));
  }

  const known = new Set(categories.map((category) => category.name.toLocaleLowerCase("sv")));
  for (const note of notes) {
    const key = note.category.toLocaleLowerCase("sv");
    if (!known.has(key)) {
      categories.push({ name: note.category });
      known.add(key);
    }
  }
  return categories;
}

export function persistCategories(categories) {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
    scheduleRemoteSave();
  } catch (error) {
    throw new Error("Kunde inte spara kategorierna i webbläsaren.", { cause: error });
  }
}

export function createCategory(categories, name) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new TypeError("Kategorin måste ha ett namn.");
  if (categories.some((category) => category.name.toLocaleLowerCase("sv") === normalizedName.toLocaleLowerCase("sv"))) {
    throw new Error("Kategorin finns redan.");
  }
  return [...categories, { name: normalizedName }];
}

export function importNotes(currentNotes, source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error("Importfilen innehåller ogiltig JSON.", { cause: error });
  }
  const importedNotes = Array.isArray(parsed) ? parsed : parsed && parsed.notes;
  if (!Array.isArray(importedNotes)) {
    throw new TypeError("Importfilen måste innehålla en anteckningslista eller ett Solar Notes-exportobjekt.");
  }

  const normalized = importedNotes.map(normalizeNote);
  const merged = new Map(currentNotes.map((note) => [note.id, note]));
  for (const note of normalized) merged.set(note.id, note);
  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.filter((category) => category && typeof category.name === "string")
    : [];
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const events = Array.isArray(parsed.events) ? parsed.events : [];
  return { notes: Array.from(merged.values()), categories, tasks, events };
}
