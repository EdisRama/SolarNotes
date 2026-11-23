const WORKSPACE_COPY = {
  universe: ["PERSONLIGT KUNSKAPSUNIVERSUM", "Universum"],
  calendar: ["PLANERA I DITT UNIVERSUM", "Kalender"],
  tasks: ["DINA NÄSTA STEG", "Uppgifter"],
  projects: ["SAMLINGAR I DITT UNIVERSUM", "Projekt"],
  library: ["DITT PERSONLIGA ARKIV", "Anteckningar"],
  statistics: ["KUNSKAP I SIFFROR", "Statistik"],
  settings: ["ANPASSA DITT UNIVERSUM", "Inställningar"]
};

export function createUI({
  onSearch,
  onSelect,
  onCreate,
  onClose,
  onNavigate,
  onToggleNote,
  onUpdateNote,
  onDeleteNote,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onSortFolder,
  onDeleteFolder,
  onCreateCategory,
  onImport,
  onExport,
  onQualityChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onLogout
}) {
  const appShell = document.querySelector("#app-shell");
  const sidebar = document.querySelector("#app-sidebar");
  const searchInput = document.querySelector("#note-search");
  const searchResults = document.querySelector("#search-results");
  const panel = document.querySelector("#detail-panel");
  const modal = document.querySelector("#note-modal");
  const form = document.querySelector("#note-form");
  const formError = document.querySelector("#form-error");
  const categoryModal = document.querySelector("#category-modal");
  const categoryForm = document.querySelector("#category-form");
  const categoryError = document.querySelector("#category-error");
  const toast = document.querySelector("#toast");
  const titleInput = document.querySelector("#note-title");
  const categoryList = document.querySelector("#category-list");
  const fileInput = document.querySelector("#import-notes-file");
  const state = { workspace: "universe", filter: "all", category: null, notes: [], categories: [], tasks: [], folders: [] };
  let toastTimer;
  let editorSaveTimer;
  let modalOpener;
  let activeNoteId = null;
  let categoriesExpanded = true;

  function showMessage(message, type = "success") {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast is-visible ${type === "error" ? "toast-error" : ""}`;
    toastTimer = window.setTimeout(() => {
      toast.className = "toast";
    }, 3200);
  }

  function setDrawerOpen(open) {
    appShell.classList.toggle("is-drawer-open", open);
    document.querySelector("#drawer-scrim").hidden = !open;
  }

  function setWorkspace(workspace, filter = "all", category = null, section = null) {
    state.workspace = workspace;
    state.filter = filter;
    state.category = category;
    const workspaceIds = ["solar-system", "calendar-view", "tasks-view", "projects-view", "library-view", "statistics-view", "settings-view"];
    const activeId = {
      universe: "solar-system",
      calendar: "calendar-view",
      tasks: "tasks-view",
      projects: "projects-view",
      library: "library-view",
      statistics: "statistics-view",
      settings: "settings-view"
    }[workspace];

    for (const id of workspaceIds) document.querySelector(`#${id}`).hidden = id !== activeId;
    panel.hidden = true;
    searchResults.hidden = true;
    onClose();

    const [eyebrow, title] = WORKSPACE_COPY[workspace] || WORKSPACE_COPY.universe;
    document.querySelector("#workspace-eyebrow").textContent = category ? `KATEGORI · ${category.toLocaleUpperCase("sv")}` : eyebrow;
    document.querySelector("#workspace-title").textContent = category || title;
    document.querySelector("#new-note-button").hidden = workspace === "statistics";
    document.querySelector("#reset-camera").hidden = workspace !== "universe";

    document.querySelectorAll(".sidebar-link[data-workspace]").forEach((link) => {
      const linkWorkspace = link.dataset.workspace;
      const linkFilter = link.dataset.filter;
      const isCategory = Boolean(link.dataset.category);
      const active = isCategory
        ? workspace === "universe" && category === link.dataset.category
        : linkWorkspace === workspace &&
          (linkFilter ? filter === linkFilter : linkWorkspace !== "library" || filter === "all");
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    });

    if (section) {
      window.setTimeout(() => document.querySelector(`#${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    }
    setDrawerOpen(false);
    renderData();
    onNavigate(workspace, { filter, category });
  }

  function visibleNotes() {
    if (state.workspace === "projects") {
      return state.notes.filter((note) => !note.archived && note.category.toLocaleLowerCase("sv") === "projects");
    }
    if (state.workspace !== "library") {
      return state.notes.filter((note) => !note.archived);
    }
    if (state.filter === "favorites") return state.notes.filter((note) => note.favorite && !note.archived);
    if (state.filter === "archived") return state.notes.filter((note) => note.archived);
    if (state.filter === "recent") {
      return state.notes
        .filter((note) => !note.archived)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
        .slice(0, 20);
    }
    return state.notes.filter((note) => !note.archived);
  }

  function renderNoteCollection(target, notes) {
    target.replaceChildren();
    if (notes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-workspace";
      empty.textContent = state.workspace === "projects"
        ? "Inga projekt ännu. Skapa en anteckning i kategorin Projects för att samla den här."
        : "Inga anteckningar i den här vyn ännu. Skapa en ny planet för att komma igång.";
      target.append(empty);
      return;
    }

    for (const note of notes) {
      const card = document.createElement("article");
      card.className = "note-card";
      const color = note.categoryColor || "#b4b4b4";
      card.style.setProperty("--category-color", color);
      const top = document.createElement("div");
      top.className = "note-card-top";
      const dot = document.createElement("span");
      dot.className = "category-dot";
      dot.style.setProperty("--category-color", color);
      const category = document.createElement("span");
      category.className = "note-card-category";
      category.textContent = note.category;
      top.append(dot, category);

      const title = document.createElement("button");
      title.type = "button";
      title.className = "note-card-title-button";
      title.textContent = note.title;
      title.addEventListener("click", () => onSelect(note.id));
      const content = document.createElement("p");
      content.textContent = note.content;
      card.append(top, title, content);

      if (note.tags.length) {
        const tags = document.createElement("div");
        tags.className = "note-card-tags";
        for (const value of note.tags) {
          const chip = document.createElement("span");
          chip.className = "tag-chip";
          chip.textContent = value;
          tags.append(chip);
        }
        card.append(tags);
      }

      const actions = document.createElement("div");
      actions.className = "note-card-actions";
      const favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = note.favorite ? "is-active" : "";
      favorite.textContent = note.favorite ? "★ Favorit" : "☆ Favorit";
      favorite.addEventListener("click", () => onToggleNote(note.id, "favorite"));
      const archive = document.createElement("button");
      archive.type = "button";
      archive.textContent = note.archived ? "Återställ" : "Arkivera";
      archive.addEventListener("click", () => onToggleNote(note.id, "archived"));
      actions.append(favorite, archive);
      card.append(actions);
      target.append(card);
    }
  }

  function renderTasks() {
    const list = document.querySelector("#task-list");
    list.replaceChildren();
    if (state.tasks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-workspace";
      empty.textContent = "Inga uppgifter ännu. Lägg till ett litet nästa steg ovan.";
      list.append(empty);
      return;
    }

    const ordered = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done));
    for (const task of ordered) {
      const row = document.createElement("div");
      row.className = `task-row${task.done ? " is-done" : ""}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.setAttribute("aria-label", `Markera ${task.title} som ${task.done ? "oavslutad" : "klar"}`);
      checkbox.addEventListener("change", () => onToggleTask(task.id));
      const title = document.createElement("span");
      title.className = "task-row-title";
      title.textContent = task.title;
      row.append(checkbox, title);
      if (task.dueDate) {
        const date = document.createElement("span");
        date.className = "task-row-date";
        date.textContent = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" })
          .format(new Date(`${task.dueDate}T00:00:00`));
        row.append(date);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "task-remove";
      remove.setAttribute("aria-label", `Ta bort uppgiften ${task.title}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => onDeleteTask(task.id));
      row.append(remove);
      list.append(row);
    }
  }

  function renderStatistics() {
    const grid = document.querySelector("#statistics-grid");
    const openTasks = state.tasks.filter((task) => !task.done).length;
    const stats = [
      ["ANTECKNINGAR", state.notes.filter((note) => !note.archived).length],
      ["FAVORITER", state.notes.filter((note) => note.favorite && !note.archived).length],
      ["ÖPPNA UPPGIFTER", openTasks],
      ["KATEGORIER", state.categories.length]
    ];
    grid.replaceChildren();
    for (const [label, value] of stats) {
      const card = document.createElement("article");
      card.className = "stat-card";
      const title = document.createElement("span");
      title.textContent = label;
      const number = document.createElement("strong");
      number.textContent = String(value);
      card.append(title, number);
      grid.append(card);
    }

    const breakdown = document.querySelector("#statistics-categories");
    breakdown.replaceChildren();
    for (const category of state.categories) {
      const count = state.notes.filter(
        (note) => note.category.toLocaleLowerCase("sv") === category.name.toLocaleLowerCase("sv") && !note.archived
      ).length;
      const row = document.createElement("div");
      row.className = "category-stat";
      const dot = document.createElement("span");
      dot.className = "category-dot";
      dot.style.setProperty("--category-color", category.color);
      const label = document.createElement("span");
      label.textContent = category.name;
      const amount = document.createElement("span");
      amount.className = "category-stat-count";
      amount.textContent = String(count);
      row.append(dot, label, amount);
      breakdown.append(row);
    }
  }

  function updateDetailActions(note) {
    const favorite = document.querySelector("#toggle-favorite");
    const archive = document.querySelector("#toggle-archive");
    favorite.classList.toggle("is-active", note.favorite);
    favorite.textContent = note.favorite ? "★ Favorit" : "☆ Favorit";
    archive.textContent = note.archived ? "Återställ från arkiv" : "Arkivera";
  }

  function renderData() {
    const activeNotes = state.notes.filter((note) => !note.archived);
    document.querySelector("#workspace-note-count").textContent = `${activeNotes.length} ${activeNotes.length === 1 ? "PLANET" : "PLANETER"}`;
    document.querySelector("#note-count").textContent = `${activeNotes.length} ${activeNotes.length === 1 ? "PLANET" : "PLANETER"}`;
    document.querySelector("#all-note-count").textContent = String(activeNotes.length);
    document.querySelector("#favorite-count").textContent = String(activeNotes.filter((note) => note.favorite).length);
    document.querySelector("#archive-count").textContent = String(state.notes.filter((note) => note.archived).length);
    document.querySelector("#task-nav-count").textContent = String(state.tasks.filter((task) => !task.done).length);

    const categories = document.querySelectorAll(".category-link");
    categories.forEach((element) => {
      const category = state.categories.find((item) => item.name === element.dataset.category);
      const count = element.querySelector(".nav-count");
      if (category && count) {
        count.textContent = String(activeNotes.filter(
          (note) => note.category.toLocaleLowerCase("sv") === category.name.toLocaleLowerCase("sv")
        ).length);
      }
    });

    renderNoteCollection(document.querySelector("#library-list"), visibleNotes());
    renderNoteCollection(
      document.querySelector("#projects-list"),
      state.notes.filter((note) => !note.archived && note.category.toLocaleLowerCase("sv") === "projects")
    );
    renderTasks();
    renderStatistics();
    if (activeNoteId) {
      const note = state.notes.find((item) => item.id === activeNoteId);
      if (note) updateDetailActions(note);
    }
  }

  function renderCategories(categories) {
    categoryList.replaceChildren();
    for (const category of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-link category-link";
      button.dataset.workspace = "universe";
      button.dataset.category = category.name;
      button.title = category.name;
      const dot = document.createElement("span");
      dot.className = "category-dot";
      dot.style.setProperty("--category-color", category.color);
      const name = document.createElement("span");
      name.textContent = category.name;
      const count = document.createElement("span");
      count.className = "nav-count";
      count.textContent = "0";
      button.append(dot, name, count);
      button.addEventListener("click", () => setWorkspace("universe", "all", category.name));
      categoryList.append(button);
    }
    categoryList.classList.toggle("is-collapsed", !categoriesExpanded);
  }

  function setData({ notes = state.notes, categories = state.categories, tasks = state.tasks, folders = state.folders }) {
    state.categories = categories;
    state.notes = notes.map((note) => ({
      ...note,
      tags: Array.isArray(note.tags) ? note.tags : [],
      categoryColor:
        categories.find((category) => category.name.toLocaleLowerCase("sv") === note.category.toLocaleLowerCase("sv"))
          ?.color || "#b4b4b4"
    }));
    state.tasks = tasks;
    state.folders = folders;
    renderCategories(categories);
    renderData();
    if (activeNoteId) {
      const activeNote = state.notes.find((note) => note.id === activeNoteId);
      if (activeNote) {
        updateDetailActions(activeNote);
        renderPlanetFolders(activeNote.id);
      }
    }
  }

  function renderPlanetFolders(planetId) {
    const list = document.querySelector("#planet-folder-list");
    list.replaceChildren();
    const folders = state.folders
      .filter((folder) => folder.planetId === planetId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (folders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "folder-empty";
      empty.textContent = "Inga stjärnmappar ännu.";
      list.append(empty);
      return;
    }
    for (const folder of folders) {
      const row = document.createElement("div");
      row.className = "folder-star-row";
      const star = document.createElement("span");
      star.className = "folder-star";
      star.textContent = "✦";
      const name = document.createElement("span");
      name.className = "folder-name";
      name.textContent = folder.name;
      name.title = folder.name;
      const actions = document.createElement("div");
      actions.className = "folder-actions";
      const move = document.createElement("select");
      move.className = "folder-move-select";
      move.setAttribute("aria-label", `Flytta mappen ${folder.name}`);
      for (const planet of state.notes.filter((item) => !item.archived)) {
        const option = document.createElement("option");
        option.value = planet.id;
        option.textContent = planet.title;
        option.selected = planet.id === planetId;
        move.append(option);
      }
      move.addEventListener("change", () => onMoveFolder(folder.id, move.value));
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.setAttribute("aria-label", `Flytta mappen ${folder.name} upp`);
      up.addEventListener("click", () => onSortFolder(folder.id, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.setAttribute("aria-label", `Flytta mappen ${folder.name} ned`);
      down.addEventListener("click", () => onSortFolder(folder.id, 1));
      const rename = document.createElement("button");
      rename.type = "button";
      rename.textContent = "Namn";
      rename.addEventListener("click", () => {
        const nextName = window.prompt("Nytt mappnamn", folder.name);
        if (nextName && nextName.trim()) onRenameFolder(folder.id, nextName.trim());
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "folder-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Ta bort mappen ${folder.name}`);
      remove.addEventListener("click", () => {
        if (window.confirm(`Ta bort mappen "${folder.name}"? Anteckningar flyttas ut ur mappen.`)) {
          onDeleteFolder(folder.id);
        }
      });
      actions.append(move, up, down, rename, remove);
      row.append(star, name, actions);
      list.append(row);
    }
  }

  function showNote(note, color) {
    activeNoteId = note.id;
    document.querySelector("#detail-title").textContent = note.title;
    const category = document.querySelector("#detail-category");
    category.textContent = note.category;
    category.style.setProperty("--category-color", color);
    document.querySelector("#detail-title-input").value = note.title;
    document.querySelector("#detail-content-input").value = note.content;
    document.querySelector("#editor-save-status").textContent = "Allt sparat";
    document.querySelector("#detail-orb").style.setProperty("--orb-color", color);
    document.querySelector("#detail-importance").textContent =
      ["LÅG", "NORMAL", "HÖG"][note.importance - 1] || "NORMAL";
    updateDetailActions(note);
    renderPlanetFolders(note.id);
    panel.hidden = false;
    panel.classList.remove("panel-enter");
    void panel.offsetWidth;
    panel.classList.add("panel-enter");
  }

  function closeDetails() {
    panel.hidden = true;
    activeNoteId = null;
    onClose();
  }

  function openModal(targetModal, focusElement) {
    modalOpener = document.activeElement;
    targetModal.hidden = false;
    if (focusElement) window.requestAnimationFrame(() => focusElement.focus());
  }

  function closeModal(targetModal, formElement) {
    targetModal.hidden = true;
    if (formElement) formElement.reset();
    if (modalOpener instanceof HTMLElement) modalOpener.focus();
    modalOpener = null;
  }

  function renderSearchResults(notes) {
    searchResults.replaceChildren();
    if (!searchInput.value.trim() || notes.length === 0) {
      searchResults.hidden = true;
      return;
    }
    for (const note of notes.slice(0, 7)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      const title = document.createElement("span");
      title.textContent = note.title;
      const category = document.createElement("small");
      category.textContent = note.category;
      button.append(title, category);
      button.addEventListener("click", () => {
        onSelect(note.id);
        searchResults.hidden = true;
      });
      searchResults.append(button);
    }
    searchResults.hidden = false;
  }

  document.querySelectorAll(".sidebar-link[data-workspace]:not(.category-link)").forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.workspace;
      const filter = link.dataset.filter || "all";
      setWorkspace(target, filter, null, link.dataset.section || null);
    });
  });
  document.querySelector(".sidebar-brand .brand").addEventListener("click", (event) => {
    event.preventDefault();
    setWorkspace("universe");
  });
  document.querySelector("#mobile-menu").addEventListener("click", () => setDrawerOpen(true));
  document.querySelector("#drawer-scrim").addEventListener("click", () => setDrawerOpen(false));
  function toggleSidebar() {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setDrawerOpen(false);
      return;
    }
    appShell.classList.toggle("is-collapsed");
    localStorage.setItem("solar-notes:sidebar-collapsed", String(appShell.classList.contains("is-collapsed")));
  }
  document.querySelector("#sidebar-collapse").addEventListener("click", toggleSidebar);
  document.querySelector("#sidebar-collapse-bottom").addEventListener("click", toggleSidebar);
  appShell.classList.toggle("is-collapsed", localStorage.getItem("solar-notes:sidebar-collapsed") === "true");
  document.querySelector("#categories-toggle").addEventListener("click", (event) => {
    categoriesExpanded = !categoriesExpanded;
    event.currentTarget.setAttribute("aria-expanded", String(categoriesExpanded));
    categoryList.classList.toggle("is-collapsed", !categoriesExpanded);
  });
  document.querySelector("#new-note-button").addEventListener("click", () => {
    formError.hidden = true;
    const folderSelect = document.querySelector("#note-folder");
    folderSelect.replaceChildren();
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Ingen mapp";
    folderSelect.append(none);
    for (const folder of [...state.folders].sort((a,b) => a.sortOrder-b.sortOrder)) {
      const planet = state.notes.find((note) => note.id === folder.planetId);
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = `${planet ? planet.title : "Planet"} · ${folder.name}`;
      folderSelect.append(option);
    }
    openModal(modal, titleInput);
  });
  document.querySelector("#close-modal").addEventListener("click", () => closeModal(modal, form));
  document.querySelector("#close-details").addEventListener("click", closeDetails);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const tags = document.querySelector("#note-tags").value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const input = {
      title: titleInput.value,
      category: document.querySelector("#note-category").value,
      content: document.querySelector("#note-content").value,
      tags,
      importance: Number(document.querySelector("#note-importance").value),
      folderId: document.querySelector("#note-folder").value
    };
    try {
      onCreate(input);
      closeModal(modal, form);
      showMessage("En ny planet har lagts till i ditt universum.");
    } catch (error) {
      formError.textContent = error.message || "Kunde inte skapa anteckningen.";
      formError.hidden = false;
    }
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal, form);
  });

  document.querySelector("#toggle-favorite").addEventListener("click", () => {
    if (activeNoteId) onToggleNote(activeNoteId, "favorite");
  });
  document.querySelector("#toggle-archive").addEventListener("click", () => {
    if (activeNoteId) {
      const note = state.notes.find((item) => item.id === activeNoteId);
      if (note) onToggleNote(activeNoteId, "archived");
    }
  });
  const titleEditor = document.querySelector("#detail-title-input");
  const contentEditor = document.querySelector("#detail-content-input");
  function scheduleEditorSave() {
    if (!activeNoteId) return;
    const status = document.querySelector("#editor-save-status");
    status.textContent = "Sparar...";
    status.className = "editor-save-status is-saving";
    window.clearTimeout(editorSaveTimer);
    editorSaveTimer = window.setTimeout(() => {
      try {
        onUpdateNote(activeNoteId, {
          title: titleEditor.value.trim() || "Namnlös planet",
          content: contentEditor.value,
          date: new Date().toISOString().slice(0, 10)
        });
        document.querySelector("#detail-title").textContent = titleEditor.value.trim() || "Namnlös planet";
        status.textContent = "Sparat";
        status.className = "editor-save-status is-saved";
      } catch (error) {
        status.textContent = "Kunde inte spara";
        status.className = "editor-save-status is-error";
        showMessage(error.message || "Ändringen kunde inte sparas.", "error");
      }
    }, 650);
  }
  titleEditor.addEventListener("input", scheduleEditorSave);
  contentEditor.addEventListener("input", scheduleEditorSave);
  document.querySelector("#delete-note-button").addEventListener("click", () => {
    if (!activeNoteId) return;
    const note = state.notes.find((item) => item.id === activeNoteId);
    if (note && window.confirm(`Ta bort planeten "${note.title}" och dess anteckning?`)) {
      onDeleteNote(activeNoteId);
      closeDetails();
    }
  });
  document.querySelector("#new-folder-button").addEventListener("click", () => {
    const form = document.querySelector("#folder-create-form");
    form.hidden = !form.hidden;
    if (!form.hidden) document.querySelector("#folder-name").focus();
  });
  document.querySelector("#folder-create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeNoteId) return;
    const input = document.querySelector("#folder-name");
    try {
      onCreateFolder({ planetId: activeNoteId, name: input.value });
      input.value = "";
      event.currentTarget.hidden = true;
      showMessage("Stjärnmappen har skapats.");
    } catch (error) {
      showMessage(error.message || "Kunde inte skapa mappen.", "error");
    }
  });

  searchInput.addEventListener("input", () => renderSearchResults(onSearch(searchInput.value)));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      renderSearchResults(onSearch(""));
      searchResults.hidden = true;
      searchInput.blur();
    }
  });
  document.querySelector("#reset-camera").addEventListener("click", () => onNavigate("reset-camera"));

  const taskForm = document.querySelector("#task-form");
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.querySelector("#task-title").value.trim();
    const dueDate = document.querySelector("#task-due-date").value;
    if (!title) return;
    try {
      onCreateTask({ title, dueDate });
      taskForm.reset();
    } catch (error) {
      showMessage(error.message || "Kunde inte skapa uppgiften.", "error");
    }
  });

  document.querySelector("#new-category-button").addEventListener("click", () => {
    openModal(categoryModal, document.querySelector("#category-name"));
    categoryError.hidden = true;
  });
  document.querySelector("#close-category-modal").addEventListener("click", () => closeModal(categoryModal, categoryForm));
  categoryModal.addEventListener("click", (event) => {
    if (event.target === categoryModal) closeModal(categoryModal, categoryForm);
  });
  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await onCreateCategory(document.querySelector("#category-name").value);
      closeModal(categoryModal, categoryForm);
      showMessage("Kategorin har skapats.");
    } catch (error) {
      categoryError.textContent = error.message || "Kunde inte skapa kategorin.";
      categoryError.hidden = false;
    }
  });

  document.querySelector("#export-notes").addEventListener("click", () => {
    try {
      onExport();
      showMessage("Dina data har exporterats.");
    } catch (error) {
      showMessage(error.message || "Kunde inte exportera data.", "error");
    }
  });
  document.querySelector("#import-notes-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      await onImport(await file.text());
      showMessage("Importen är klar.");
    } catch (error) {
      showMessage(error.message || "Kunde inte importera filen.", "error");
    } finally {
      fileInput.value = "";
    }
  });
  document.querySelector("#quality-setting").addEventListener("change", (event) => {
    try {
      onQualityChange(event.target.value);
      showMessage("Grafikkvaliteten har uppdaterats.");
    } catch (error) {
      showMessage(error.message || "Kunde inte ändra grafikkvaliteten.", "error");
    }
  });
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      await onLogout();
    } catch (error) {
      showMessage(error.message || "Kunde inte logga ut.", "error");
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
    }
    const target = event.target;
    const isEditing =
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === "1") setWorkspace("universe");
      if (event.key === "2") setWorkspace("calendar");
    }
    if (event.key === "Escape") {
      if (!modal.hidden) closeModal(modal, form);
      else if (!categoryModal.hidden) closeModal(categoryModal, categoryForm);
      else setDrawerOpen(false);
      return;
    }
    const activeModal = !modal.hidden ? modal : !categoryModal.hidden ? categoryModal : null;
    if (activeModal && event.key === "Tab") {
      const focusable = activeModal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  return {
    showNote,
    closeDetails,
    showMessage,
    setView: setWorkspace,
    setData,
    setQuality(value) {
      document.querySelector("#quality-setting").value = value;
    },
    getState: () => state,
    setCount(count) {
      document.querySelector("#workspace-note-count").textContent = `${count} ${count === 1 ? "PLANET" : "PLANETER"}`;
      document.querySelector("#note-count").textContent = `${count} ${count === 1 ? "PLANET" : "PLANETER"}`;
    },
    showError(message) {
      const error = document.querySelector("#scene-error");
      error.textContent = message;
      error.hidden = false;
    },
    hideError() {
      document.querySelector("#scene-error").hidden = true;
    }
  };
}
