import * as THREE from "three";
import { createSolarScene } from "./scene.js";
import { colorForCategory, createPlanetSystem } from "./planets.js";
import {
  createCategory,
  createNote,
  importNotes,
  loadCategories,
  loadNotes,
  persistCategories,
  persistNotes,
  updateNote
} from "./notes.js";
import { createTask, loadTasks, mergeTasks, persistTasks } from "./tasks.js";
import {
  createCalendar,
  loadCalendarEvents,
  mergeCalendarEvents,
  persistCalendarEvents
} from "./calendar.js";
import { createUI } from "./ui.js";
import {
  authenticate,
  loadCloudData,
  logout,
  saveCloudData,
  showAuthErrorMessage
} from "./auth.js";
import { configurePersistence, hydrateLocalData, readLocalData } from "./persistence.js";
import {
  createFolder,
  deleteFolder,
  loadFolders,
  persistFolders,
  updateFolder
} from "./folders.js";
import "./styles.css";

const container = document.querySelector("#solar-system");
const labelLayer = document.querySelector("#planet-labels");
const canvasPointer = { x: 0, y: 0, moved: false };
let notes = [];
let categories = [];
let tasks = [];
let folders = [];
let solarScene;
let planetSystem;
let calendar;
let ui;
let quality = "auto";
const motionScale = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.18 : 1;

function showNoteById(id) {
  const note = notes.find((item) => item.id === id);
  if (!note) return;
  const entry = planetSystem && planetSystem.get(id);
  if (entry) {
    planetSystem.setSelected(id);
    planetSystem.focusPlanet(id, solarScene);
  }
  ui.showNote(note, entry ? entry.color : colorForCategory(note.category));
}

function updateCategoryColors() {
  categories = categories.map((category) => ({
    ...category,
    color: colorForCategory(category.name)
  }));
}

function filterNoteIds(filter) {
  if (filter === "favorites") {
    return notes.filter((note) => note.favorite && !note.archived).map((note) => note.id);
  }
  if (filter === "archived") {
    return notes.filter((note) => note.archived).map((note) => note.id);
  }
  if (filter === "recent") {
    return notes
      .filter((note) => !note.archived)
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, 20)
      .map((note) => note.id);
  }
  return notes.filter((note) => !note.archived).map((note) => note.id);
}

function syncPlanetFilters() {
  if (!planetSystem) return;
  const state = ui.getState();
  if (state.workspace === "universe") {
    planetSystem.setNoteFilter(null);
    planetSystem.setCategoryFilter(state.category);
  } else if (state.workspace === "library") {
    planetSystem.setCategoryFilter(null);
    planetSystem.setNoteFilter(filterNoteIds(state.filter));
  } else {
    planetSystem.setCategoryFilter(null);
    planetSystem.setNoteFilter(null);
  }
}

function refreshData() {
  updateCategoryColors();
  ui.setData({ notes, categories, tasks, folders });
  syncPlanetFilters();
  if (calendar) calendar.render();
}

function exportData() {
  const data = {
    format: "solar-notes",
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
    categories: categories.map(({ name }) => ({ name })),
    tasks,
    events: loadCalendarEvents(),
    folders
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `solar-notes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mergeCategories(existing, incoming, incomingNotes) {
  const result = [...existing];
  const names = new Set(result.map((category) => category.name.toLocaleLowerCase("sv")));
  for (const category of incoming) {
    if (!category || typeof category.name !== "string") continue;
    const name = category.name.trim();
    const key = name.toLocaleLowerCase("sv");
    if (name && !names.has(key)) {
      result.push({ name });
      names.add(key);
    }
  }
  for (const note of incomingNotes) {
    const key = note.category.toLocaleLowerCase("sv");
    if (!names.has(key)) {
      result.push({ name: note.category });
      names.add(key);
    }
  }
  return result;
}

async function start() {
  const session = await authenticate();
  const cloudData = await loadCloudData(session);
  if (cloudData) {
    hydrateLocalData(cloudData);
  } else {
    const existingData = readLocalData();
    if (existingData) await saveCloudData(existingData);
  }
  configurePersistence((data) => saveCloudData(data));
  window.addEventListener("solar-notes:persistence-error", (event) => {
    if (ui) ui.showMessage(event.detail.message, "error");
  });

  ui = createUI({
    onSearch(query) {
      if (planetSystem) return planetSystem.setSearch(query);
      const normalized = query.trim().toLocaleLowerCase("sv");
      return notes.filter((note) =>
        `${note.title} ${note.category} ${note.content} ${note.tags.join(" ")}`
          .toLocaleLowerCase("sv")
          .includes(normalized)
      );
    },
    onSelect: showNoteById,
    onClose() {
      if (planetSystem) planetSystem.setSelected(null);
    },
    onNavigate(view, options = {}) {
      if (view === "reset-camera") {
        if (solarScene) solarScene.resetCamera();
        return;
      }
      syncPlanetFilters();
    },
    onCreate(input) {
      const note = createNote(input);
      const updatedNotes = [...notes, note];
      const hasCategory = categories.some(
        (category) => category.name.toLocaleLowerCase("sv") === note.category.toLocaleLowerCase("sv")
      );
      if (!hasCategory) {
        const updatedCategories = [...categories, { name: note.category }];
        persistCategories(updatedCategories);
        categories = updatedCategories;
      }
      persistNotes(updatedNotes);
      notes = updatedNotes;
      if (planetSystem) planetSystem.add(note, notes.length - 1);
      refreshData();
      return true;
    },
    onToggleNote(id, field) {
      const note = notes.find((item) => item.id === id);
      if (!note || !["favorite", "archived"].includes(field)) return;
      try {
        const updatedNotes = updateNote(notes, id, { [field]: !note[field] });
        persistNotes(updatedNotes);
        notes = updatedNotes;
        refreshData();
      } catch (error) {
        ui.showMessage(error.message || "Kunde inte uppdatera anteckningen.", "error");
      }
    },
    onUpdateNote(id, updates) {
      const updatedNotes = updateNote(notes, id, updates);
      persistNotes(updatedNotes);
      notes = updatedNotes;
      refreshData();
      return true;
    },
    onDeleteNote(id) {
      const updatedNotes = notes.filter((note) => note.id !== id);
      persistNotes(updatedNotes);
      const updatedFolders = folders.filter((folder) => folder.planetId !== id);
      persistFolders(updatedFolders);
      notes = updatedNotes;
      folders = updatedFolders;
      refreshData();
      if (planetSystem) planetSystem.remove(id);
    },
    onCreateFolder(input) {
      const updatedFolders = createFolder(folders, input);
      persistFolders(updatedFolders);
      folders = updatedFolders;
      refreshData();
    },
    onRenameFolder(id, name) {
      const updatedFolders = updateFolder(folders, id, { name });
      persistFolders(updatedFolders);
      folders = updatedFolders;
      refreshData();
    },
    onMoveFolder(id, planetId) {
      const updatedFolders = updateFolder(folders, id, { planetId });
      persistFolders(updatedFolders);
      folders = updatedFolders;
      refreshData();
    },
    onSortFolder(id, direction) {
      const folder = folders.find((item) => item.id === id);
      if (!folder) return;
      const siblings = folders
        .filter((item) => item.planetId === folder.planetId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const index = siblings.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= siblings.length) return;
      [siblings[index], siblings[nextIndex]] = [siblings[nextIndex], siblings[index]];
      const order = new Map(siblings.map((item, orderIndex) => [item.id, orderIndex]));
      const updatedFolders = folders.map((item) =>
        order.has(item.id) ? { ...item, sortOrder: order.get(item.id) } : item
      );
      persistFolders(updatedFolders);
      folders = updatedFolders;
      refreshData();
    },
    onDeleteFolder(id) {
      const updatedFolders = deleteFolder(folders, id);
      persistFolders(updatedFolders);
      const updatedNotes = notes.map((note) =>
        note.folderId === id ? { ...note, folderId: "" } : note
      );
      persistNotes(updatedNotes);
      folders = updatedFolders;
      notes = updatedNotes;
      refreshData();
    },
    onCreateCategory(name) {
      const updatedCategories = createCategory(categories, name);
      persistCategories(updatedCategories);
      categories = updatedCategories;
      refreshData();
    },
    async onImport(source) {
      const imported = importNotes(notes, source);
      const updatedNotes = imported.notes;
      const updatedCategories = mergeCategories(categories, imported.categories, updatedNotes);
      const updatedTasks = mergeTasks(tasks, imported.tasks);
      const updatedEvents = mergeCalendarEvents(loadCalendarEvents(), imported.events);
      persistNotes(updatedNotes);
      persistCategories(updatedCategories);
      persistTasks(updatedTasks);
      persistCalendarEvents(updatedEvents);
      const importedFolders = Array.isArray(JSON.parse(source).folders)
        ? JSON.parse(source).folders
        : [];
      const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
      importedFolders.forEach((folder) => {
        if (folder && typeof folder.id === "string" && typeof folder.name === "string") {
          folderMap.set(folder.id, folder);
        }
      });
      const updatedFolders = Array.from(folderMap.values());
      persistFolders(updatedFolders);
      notes = updatedNotes;
      categories = updatedCategories;
      tasks = updatedTasks;
      folders = updatedFolders;
      if (calendar) calendar.setEvents(updatedEvents);
      if (planetSystem) {
        for (const [index, note] of notes.entries()) {
          if (!planetSystem.get(note.id)) planetSystem.add(note, index);
          else planetSystem.updateNote(note);
        }
      }
      refreshData();
    },
    onExport: exportData,
    onQualityChange(value) {
      quality = value;
      try {
        localStorage.setItem("solar-notes:quality:v1", value);
        if (solarScene) solarScene.setQuality(value);
      } catch (error) {
        throw new Error("Kunde inte spara inställningen för grafikkvalitet.", { cause: error });
      }
    },
    onCreateTask(input) {
      const task = createTask(input);
      const updatedTasks = [...tasks, task];
      persistTasks(updatedTasks);
      tasks = updatedTasks;
      refreshData();
      ui.showMessage("Uppgiften har lagts till.");
    },
    onToggleTask(id) {
      const updatedTasks = tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done, updatedAt: new Date().toISOString() } : task
      );
      try {
        persistTasks(updatedTasks);
        tasks = updatedTasks;
        refreshData();
      } catch (error) {
        ui.showMessage(error.message || "Kunde inte uppdatera uppgiften.", "error");
      }
    },
    onDeleteTask(id) {
      const updatedTasks = tasks.filter((task) => task.id !== id);
      try {
        persistTasks(updatedTasks);
        tasks = updatedTasks;
        refreshData();
      } catch (error) {
        ui.showMessage(error.message || "Kunde inte ta bort uppgiften.", "error");
      }
    },
    onLogout: logout
  });

  try {
    notes = await loadNotes();
    tasks = loadTasks();
    categories = loadCategories(notes);
    folders = loadFolders();
  } catch (error) {
    ui.showError(error.message || "Solar Notes kunde inte läsa in dina data.");
    throw error;
  }

  quality = localStorage.getItem("solar-notes:quality:v1") || "auto";
  ui.setQuality(quality);
  refreshData();
  calendar = createCalendar(document.querySelector("#calendar-view"), {
    onStatus(message) {
      ui.showMessage(message);
    },
    getNotes: () => notes,
    getTasks: () => tasks,
    onTaskToggle(id) {
      const updatedTasks = tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done, updatedAt: new Date().toISOString() } : task
      );
      try {
        persistTasks(updatedTasks);
        tasks = updatedTasks;
        refreshData();
      } catch (error) {
        ui.showMessage(error.message || "Kunde inte uppdatera uppgiften.", "error");
      }
    },
    onSelectNote: showNoteById
  });

  try {
    solarScene = createSolarScene(container, quality);
  } catch (error) {
    ui.showMessage("3D-grafik är inte tillgänglig. Kalendern och dina anteckningar fungerar fortfarande.", "error");
    ui.setView("calendar");
    console.error("WebGL kunde inte starta:", error);
    return;
  }
  planetSystem = createPlanetSystem(solarScene.scene, labelLayer);
  notes.forEach((note, index) => planetSystem.add(note, index));
  ui.setCount(notes.filter((note) => !note.archived).length);
  ui.hideError();
  syncPlanetFilters();

  const pointerDown = (event) => {
    canvasPointer.x = event.clientX;
    canvasPointer.y = event.clientY;
    canvasPointer.moved = false;
  };
  const pointerMove = (event) => {
    if (Math.hypot(event.clientX - canvasPointer.x, event.clientY - canvasPointer.y) > 5) {
      canvasPointer.moved = true;
    }
    const entry = planetSystem.intersect(event, solarScene.renderer.domElement, solarScene.camera);
    planetSystem.setHovered(entry ? entry.note.id : null);
    solarScene.renderer.domElement.style.cursor = entry ? "pointer" : "grab";
  };
  const pointerUp = (event) => {
    if (canvasPointer.moved || event.target !== solarScene.renderer.domElement) return;
    const entry = planetSystem.intersect(event, solarScene.renderer.domElement, solarScene.camera);
    if (entry) showNoteById(entry.note.id);
  };

  labelLayer.addEventListener("click", (event) => {
    const label = event.target.closest(".planet-label");
    if (label) showNoteById(label.dataset.noteId);
  });
  labelLayer.addEventListener("pointerover", (event) => {
    const label = event.target.closest(".planet-label");
    if (label) planetSystem.setHovered(label.dataset.noteId);
  });
  labelLayer.addEventListener("pointerout", (event) => {
    const label = event.target.closest(".planet-label");
    const nextLabel =
      event.relatedTarget instanceof Element && event.relatedTarget.closest(".planet-label");
    if (label && !nextLabel) planetSystem.setHovered(null);
  });
  solarScene.renderer.domElement.addEventListener("pointerleave", () => {
    planetSystem.setHovered(null);
    solarScene.renderer.domElement.style.cursor = "grab";
  });
  solarScene.renderer.domElement.addEventListener("pointerdown", pointerDown);
  solarScene.renderer.domElement.addEventListener("pointermove", pointerMove);
  solarScene.renderer.domElement.addEventListener("pointerup", pointerUp);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    solarScene.sun.rotation.y += delta * 0.035 * motionScale;
    solarScene.sunCore.rotation.y += delta * 0.08 * motionScale;
    solarScene.sun.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.4) * 0.012 * motionScale);
    solarScene.updateAmbient(delta * motionScale, clock.elapsedTime);
    solarScene.updateFocus(delta);
    solarScene.controls.update();
    planetSystem.update(delta * motionScale, solarScene.camera);
    solarScene.renderer.render(solarScene.scene, solarScene.camera);
  }
  animate();
}

start().catch((error) => {
  console.error("Solar Notes kunde inte starta:", error);
  showAuthErrorMessage(error.message || "Solar Notes kunde inte starta.");
});
