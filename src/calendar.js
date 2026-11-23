import { scheduleRemoteSave } from "./persistence.js";

const STORAGE_KEY = "solar-notes:calendar-events:v1";
const DATE_COLORS = ["#6f91d7", "#8990db", "#5d9bb5", "#a58bc7", "#789fc0", "#b28c91", "#728e9c"];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateColor(day) {
  let hash = 0;
  for (const character of day) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return DATE_COLORS[Math.abs(hash) % DATE_COLORS.length];
}

function normalizeEvent(event, index = 0) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError(`Kalenderhändelse ${index + 1} har ett ogiltigt format.`);
  }
  const title = typeof event.title === "string" ? event.title.trim() : "";
  const date = typeof event.date === "string" ? event.date : "";
  if (!title || !isValidDateKey(date)) {
    throw new TypeError(`Kalenderhändelse ${index + 1} måste ha en titel och ett giltigt datum.`);
  }
  return {
    id: typeof event.id === "string" && event.id ? event.id : `event-${Date.now()}-${index}`,
    title,
    date,
    updatedAt: typeof event.updatedAt === "string" ? event.updatedAt : new Date().toISOString()
  };
}

function loadEvents() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new Error("Kalenderns sparade händelser innehåller ogiltig JSON.", { cause: error });
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError("Kalenderns sparade händelser måste vara en lista.");
  }
  return parsed.map(normalizeEvent);
}

function saveEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    scheduleRemoteSave();
  } catch (error) {
    throw new Error("Kunde inte spara kalenderhändelsen i webbläsaren.", { cause: error });
  }
}

export function loadCalendarEvents() {
  return loadEvents();
}

export function persistCalendarEvents(events) {
  saveEvents(events.map(normalizeEvent));
}

export function mergeCalendarEvents(current, imported) {
  if (!Array.isArray(imported)) {
    throw new TypeError("Importfilens kalenderhändelser måste vara en lista.");
  }
  const merged = new Map(current.map((event) => [event.id, event]));
  imported.map(normalizeEvent).forEach((event) => merged.set(event.id, event));
  return Array.from(merged.values());
}

export function createCalendar(container, options = {}) {
  const monthLabel = container.querySelector("#calendar-month");
  const daysGrid = container.querySelector("#calendar-days");
  const selectedLabel = container.querySelector("#calendar-selected-date");
  const eventList = container.querySelector("#calendar-events");
  const taskList = container.querySelector("#calendar-day-tasks");
  const noteList = container.querySelector("#calendar-day-notes");
  const form = container.querySelector("#calendar-event-form");
  const titleInput = container.querySelector("#calendar-event-title");
  const errorLabel = container.querySelector("#calendar-error");
  const onStatus = options.onStatus || (() => {});
  const getNotes = options.getNotes || (() => []);
  const getTasks = options.getTasks || (() => []);
  const onTaskToggle = options.onTaskToggle || (() => {});
  const onSelectNote = options.onSelectNote || (() => {});
  let events = [];
  let initialStorageError = null;
  try {
    events = loadEvents();
  } catch (error) {
    initialStorageError = error;
  }
  const visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDay = dateKey(new Date());

  function showError(message) {
    errorLabel.textContent = message;
    errorLabel.hidden = !message;
  }

  function renderEvents() {
    const dayEvents = events.filter((event) => event.date === selectedDay);
    eventList.replaceChildren();

    if (dayEvents.length === 0) {
      const empty = document.createElement("p");
      empty.className = "calendar-empty-state";
      empty.textContent = "Inga händelser ännu. Lägg till en för den här dagen.";
      eventList.append(empty);
      return;
    }

    for (const event of dayEvents) {
      const row = document.createElement("div");
      row.className = "calendar-event";
      const eventTitle = document.createElement("span");
      eventTitle.textContent = event.title;
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "calendar-event-edit";
      editButton.setAttribute("aria-label", `Redigera händelsen ${event.title}`);
      editButton.textContent = "Redigera";
      editButton.addEventListener("click", () => {
        const editor = document.createElement("form");
        editor.className = "calendar-event-editor";
        const input = document.createElement("input");
        input.className = "form-input";
        input.maxLength = 100;
        input.value = event.title;
        input.setAttribute("aria-label", "Redigera händelse");
        const saveButton = document.createElement("button");
        saveButton.className = "calendar-event-edit";
        saveButton.type = "submit";
        saveButton.textContent = "Spara";
        editor.append(input, saveButton);
        editor.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const title = input.value.trim();
          if (!title) {
            showError("Händelsen måste ha en titel.");
            return;
          }
          const updatedEvents = events.map((item) =>
            item.id === event.id ? { ...item, title, updatedAt: new Date().toISOString() } : item
          );
          try {
            saveEvents(updatedEvents);
            events = updatedEvents;
            showError("");
            render();
            onStatus("Händelsen har uppdaterats.");
          } catch (error) {
            showError(error.message);
          }
        });
        row.replaceChildren(editor);
        input.focus();
        input.select();
      });
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "calendar-event-remove";
      removeButton.setAttribute("aria-label", `Ta bort händelsen ${event.title}`);
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        const updatedEvents = events.filter((item) => item.id !== event.id);
        try {
          saveEvents(updatedEvents);
          events = updatedEvents;
          render();
        } catch (error) {
          showError(error.message);
        }
      });
      row.append(eventTitle, editButton, removeButton);
      eventList.append(row);
    }
  }

  function renderDayTasks() {
    const dayTasks = getTasks().filter((task) => task.dueDate === selectedDay);
    taskList.replaceChildren();
    if (dayTasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "calendar-empty-state";
      empty.textContent = "Inga uppgifter med förfallodatum den här dagen.";
      taskList.append(empty);
      return;
    }

    for (const task of dayTasks) {
      const label = document.createElement("label");
      label.className = `calendar-task${task.done ? " is-done" : ""}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.setAttribute("aria-label", `Markera ${task.title} som ${task.done ? "oavslutad" : "klar"}`);
      checkbox.addEventListener("change", () => onTaskToggle(task.id));
      const title = document.createElement("span");
      title.textContent = task.title;
      label.append(checkbox, title);
      taskList.append(label);
    }
  }

  function renderDayNotes() {
    const dayNotes = getNotes().filter(
      (note) => (note.date || note.createdAt.slice(0, 10)) === selectedDay && !note.archived
    );
    noteList.replaceChildren();
    if (dayNotes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "calendar-empty-state";
      empty.textContent = "Inga anteckningar skapades den här dagen.";
      noteList.append(empty);
      return;
    }

    for (const note of dayNotes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-note-link";
      button.textContent = note.title;
      button.addEventListener("click", () => onSelectNote(note.id));
      noteList.append(button);
    }
  }

  function selectDay(key) {
    selectedDay = key;
    render();
  }

  function render() {
    monthLabel.textContent = new Intl.DateTimeFormat("sv-SE", {
      month: "long",
      year: "numeric"
    })
      .format(visibleMonth)
      .toLocaleUpperCase("sv");

    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    daysGrid.replaceChildren();

    for (let index = 0; index < cellCount; index += 1) {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-cell calendar-cell-empty";
        emptyCell.setAttribute("aria-hidden", "true");
        daysGrid.append(emptyCell);
        continue;
      }

      const date = new Date(year, month, dayNumber);
      const key = dateKey(date);
      const dayEvents = events.filter((event) => event.date === key);
      const dayTasks = getTasks().filter((task) => task.dueDate === key);
      const dayNotes = getNotes().filter(
        (note) => (note.date || note.createdAt.slice(0, 10)) === key && !note.archived
      );
      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "calendar-cell";
      dayButton.classList.toggle("is-selected", key === selectedDay);
      dayButton.classList.toggle("is-today", key === dateKey(new Date()));
      dayButton.setAttribute("aria-pressed", String(key === selectedDay));
      dayButton.setAttribute(
        "aria-label",
        `${new Intl.DateTimeFormat("sv-SE", {
          weekday: "long",
          day: "numeric",
          month: "long"
        }).format(date)}${dayEvents.length ? `, ${dayEvents.length} händelser` : ""}${dayTasks.length ? `, ${dayTasks.length} uppgifter` : ""}${dayNotes.length ? `, ${dayNotes.length} anteckningar` : ""}`
      );

      const topLine = document.createElement("span");
      topLine.className = "calendar-cell-top";
      const dateNumber = document.createElement("span");
      dateNumber.className = "calendar-date-number";
      dateNumber.textContent = String(dayNumber).padStart(2, "0");
      topLine.append(dateNumber);

      const planet = document.createElement("span");
      planet.className = "calendar-planet";
      planet.style.setProperty("--date-color", dateColor(key));
      planet.textContent = String(dayNumber);
      planet.setAttribute("aria-hidden", "true");

      const eventIndicator = document.createElement("span");
      eventIndicator.className = "calendar-event-indicator";
      eventIndicator.classList.toggle(
        "has-events",
        dayEvents.length + dayTasks.length + dayNotes.length > 0
      );
      eventIndicator.setAttribute("aria-hidden", "true");
      dayButton.append(topLine, planet, eventIndicator);
      dayButton.addEventListener("click", () => selectDay(key));
      daysGrid.append(dayButton);
    }

    const [yearValue, monthValue, dayValue] = selectedDay.split("-").map(Number);
    selectedLabel.textContent = new Intl.DateTimeFormat("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(yearValue, monthValue - 1, dayValue));
    renderEvents();
    renderDayTasks();
    renderDayNotes();
  }

  container.querySelector("#calendar-previous").addEventListener("click", () => {
    visibleMonth.setMonth(visibleMonth.getMonth() - 1);
    selectedDay = dateKey(visibleMonth);
    render();
  });
  container.querySelector("#calendar-next").addEventListener("click", () => {
    visibleMonth.setMonth(visibleMonth.getMonth() + 1);
    selectedDay = dateKey(visibleMonth);
    render();
  });
  container.querySelector("#calendar-today").addEventListener("click", () => {
    const today = new Date();
    visibleMonth.setFullYear(today.getFullYear(), today.getMonth(), 1);
    selectedDay = dateKey(today);
    render();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (initialStorageError) {
      showError(initialStorageError.message);
      return;
    }
    const title = titleInput.value.trim();
    if (!title) {
      showError("Skriv en titel för händelsen.");
      return;
    }

    const newEvent = {
      id: globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      date: selectedDay,
      updatedAt: new Date().toISOString()
    };
    const updatedEvents = [...events, newEvent];
    try {
      saveEvents(updatedEvents);
      events = updatedEvents;
      titleInput.value = "";
      showError("");
      render();
      onStatus("Händelsen har sparats i kalendern.");
    } catch (error) {
      showError(error.message);
    }
  });

  if (initialStorageError) {
    showError(initialStorageError.message);
    titleInput.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;
  }
  render();
  return {
    render,
    setEvents(nextEvents) {
      events = nextEvents.map(normalizeEvent);
      initialStorageError = null;
      titleInput.disabled = false;
      form.querySelector('button[type="submit"]').disabled = false;
      showError("");
      render();
    }
  };
}
