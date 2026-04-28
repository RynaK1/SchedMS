const STORAGE_KEY = "schedms-data-v1";
const LIST_TYPES = ["daily", "weekly", "todo"];
const PERSON_IDS = ["p1", "p2"];

const blankPersonTasks = () => ({ p1: [], p2: [] });
const blankPersonFilters = () => ({ p1: "unfinished", p2: "unfinished" });

const defaultState = {
  settings: {
    dailyResetTime: "00:00",
    weeklyResetDay: 3,
    weeklyResetTime: "00:00",
    people: {
      p1: "Player 1",
      p2: "Player 2",
    },
  },
  periodIds: {
    daily: "",
    weekly: "",
  },
  activePerson: {
    daily: "p1",
    weekly: "p1",
    todo: "p1",
  },
  filters: {
    daily: blankPersonFilters(),
    weekly: blankPersonFilters(),
    todo: blankPersonFilters(),
  },
  tasks: {
    daily: blankPersonTasks(),
    weekly: blankPersonTasks(),
    todo: blankPersonTasks(),
  },
  undoDelete: null,
};

let state = loadState();

const els = {
  views: {
    lists: document.getElementById("lists-view"),
    options: document.getElementById("options-view"),
  },
  topTabs: document.querySelectorAll(".top-tab"),
  personTabs: document.querySelectorAll(".person-tab"),
  statusTabs: document.querySelectorAll(".status-tab"),
  addForms: document.querySelectorAll(".add-task-form"),
  lists: {
    daily: { list: document.getElementById("daily-task-list"), empty: document.getElementById("daily-empty"), error: document.getElementById("daily-error") },
    weekly: { list: document.getElementById("weekly-task-list"), empty: document.getElementById("weekly-empty"), error: document.getElementById("weekly-error") },
    todo: { list: document.getElementById("todo-task-list"), empty: document.getElementById("todo-empty"), error: document.getElementById("todo-error") },
  },
  dailyResetLabel: document.getElementById("daily-reset-label"),
  weeklyResetLabel: document.getElementById("weekly-reset-label"),
  dailyResetTime: document.getElementById("daily-reset-time"),
  weeklyResetDay: document.getElementById("weekly-reset-day"),
  weeklyResetTime: document.getElementById("weekly-reset-time"),
  person1Name: document.getElementById("person1-name"),
  person2Name: document.getElementById("person2-name"),
  saveStatus: document.getElementById("save-status"),
  undoDelete: document.getElementById("undo-delete"),
};

initialize();

function initialize() {
  hydrateSettingsUI();
  runResetsIfNeeded();
  wireEvents();
  renderAll();
}

function wireEvents() {
  els.topTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));

  els.personTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activePerson[tab.dataset.list] = tab.dataset.person;
      saveState();
      renderAll();
    });
  });

  els.statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const listType = tab.dataset.list;
      const personId = state.activePerson[listType];
      state.filters[listType][personId] = tab.dataset.filter;
      saveState();
      renderAll();
    });
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const listType = form.dataset.list;
      const personId = state.activePerson[listType];
      const input = form.querySelector("input");
      const text = input.value.trim();

      if (text.length < 3) {
        setFormError(listType, "Task must be at least 3 characters.");
        return;
      }

      setFormError(listType, "");
      state.tasks[listType][personId].push({ id: crypto.randomUUID(), text, done: false });
      input.value = "";
      saveState();
      renderAll();
    });
  });

  els.dailyResetTime.addEventListener("change", () => {
    state.settings.dailyResetTime = els.dailyResetTime.value || "00:00";
    saveState();
    runResetsIfNeeded();
    renderAll();
  });

  els.weeklyResetDay.addEventListener("change", () => {
    state.settings.weeklyResetDay = Number(els.weeklyResetDay.value);
    saveState();
    runResetsIfNeeded();
    renderAll();
  });

  els.weeklyResetTime.addEventListener("change", () => {
    state.settings.weeklyResetTime = els.weeklyResetTime.value || "00:00";
    saveState();
    runResetsIfNeeded();
    renderAll();
  });

  els.person1Name.addEventListener("input", () => updatePersonName("p1", els.person1Name.value));
  els.person2Name.addEventListener("input", () => updatePersonName("p2", els.person2Name.value));

  els.undoDelete.addEventListener("click", () => {
    if (!state.undoDelete) return;
    const { listType, personId, task } = state.undoDelete;
    state.tasks[listType][personId].push(task);
    state.undoDelete = null;
    saveState();
    renderAll();
  });
}

function updatePersonName(personId, value) {
  const clean = value.trim();
  state.settings.people[personId] = clean || (personId === "p1" ? "Player 1" : "Player 2");
  saveState();
  renderAll();
}

function setFormError(listType, message) {
  els.lists[listType].error.textContent = message;
}

function switchView(viewName) {
  Object.entries(els.views).forEach(([name, section]) => section.classList.toggle("active", name === viewName));
  els.topTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
}

function renderAll() {
  LIST_TYPES.forEach((listType) => {
    renderPersonTabs(listType);
    renderList(listType);
    syncStatusTabs(listType);
  });
  renderResetLabels();
  renderUndoButton();
  hydrateNameInputs();
}

function renderPersonTabs(listType) {
  const selectedPerson = state.activePerson[listType];
  document.querySelectorAll(`.person-tab[data-list="${listType}"]`).forEach((tab) => {
    const personId = tab.dataset.person;
    tab.classList.toggle("active", personId === selectedPerson);
    tab.textContent = state.settings.people[personId];
  });
}

function renderList(listType) {
  const personId = state.activePerson[listType];
  const personTasks = state.tasks[listType][personId];
  const filter = state.filters[listType][personId];
  const listEl = els.lists[listType].list;
  const emptyEl = els.lists[listType].empty;

  const unfinishedCount = personTasks.filter((task) => !task.done).length;
  const finishedCount = personTasks.length - unfinishedCount;
  updateTabCount(listType, unfinishedCount, finishedCount);

  const filtered = personTasks.filter((task) => (filter === "unfinished" ? !task.done : task.done));
  listEl.innerHTML = "";

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""}`;

    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.addEventListener("change", () => {
      task.done = check.checked;
      saveState();
      renderAll();
    });

    const text = document.createElement("span");
    text.textContent = task.text;
    label.append(check, text);

    const del = document.createElement("button");
    del.textContent = "remove";
    del.className = "delete-btn";
    del.addEventListener("click", () => {
      state.tasks[listType][personId] = state.tasks[listType][personId].filter((item) => item.id !== task.id);
      state.undoDelete = { listType, personId, task };
      saveState();
      renderAll();
    });

    li.append(label, del);
    listEl.appendChild(li);
  });

  emptyEl.style.display = filtered.length === 0 ? "block" : "none";
}

function updateTabCount(listType, unfinishedCount, finishedCount) {
  document.querySelector(`.status-tab[data-list="${listType}"][data-filter="unfinished"]`).textContent = `Unfinished (${unfinishedCount})`;
  document.querySelector(`.status-tab[data-list="${listType}"][data-filter="finished"]`).textContent = `Finished (${finishedCount})`;
}

function syncStatusTabs(listType) {
  const personId = state.activePerson[listType];
  const activeFilter = state.filters[listType][personId];
  document.querySelectorAll(`.status-tab[data-list="${listType}"]`).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === activeFilter);
  });
}

function renderUndoButton() {
  els.undoDelete.disabled = !Boolean(state.undoDelete);
}

function hydrateSettingsUI() {
  els.dailyResetTime.value = state.settings.dailyResetTime;
  els.weeklyResetDay.value = String(state.settings.weeklyResetDay);
  els.weeklyResetTime.value = state.settings.weeklyResetTime;
  hydrateNameInputs();
}

function hydrateNameInputs() {
  els.person1Name.value = state.settings.people.p1;
  els.person2Name.value = state.settings.people.p2;
}

function runResetsIfNeeded() {
  const now = new Date();
  const nextDailyPeriodId = dailyPeriodId(now, state.settings.dailyResetTime);
  const nextWeeklyPeriodId = weeklyPeriodId(now, state.settings.weeklyResetDay, state.settings.weeklyResetTime);

  if (state.periodIds.daily !== nextDailyPeriodId) {
    state.periodIds.daily = nextDailyPeriodId;
    PERSON_IDS.forEach((personId) => {
      state.tasks.daily[personId] = state.tasks.daily[personId].map((task) => ({ ...task, done: false }));
      state.filters.daily[personId] = "unfinished";
    });
  }

  if (state.periodIds.weekly !== nextWeeklyPeriodId) {
    state.periodIds.weekly = nextWeeklyPeriodId;
    PERSON_IDS.forEach((personId) => {
      state.tasks.weekly[personId] = state.tasks.weekly[personId].map((task) => ({ ...task, done: false }));
      state.filters.weekly[personId] = "unfinished";
    });
  }

  saveState();
}

function dailyPeriodId(now, timeStr) {
  const [hour, minute] = parseTime(timeStr);
  const pivot = new Date(now);
  pivot.setHours(hour, minute, 0, 0);
  if (now < pivot) pivot.setDate(pivot.getDate() - 1);
  return dateOnlyId(pivot);
}

function weeklyPeriodId(now, resetDay, timeStr) {
  const [hour, minute] = parseTime(timeStr);
  const pivot = new Date(now);
  pivot.setHours(hour, minute, 0, 0);
  const diffDays = (now.getDay() - resetDay + 7) % 7;
  pivot.setDate(now.getDate() - diffDays);
  if (diffDays === 0 && now < pivot) pivot.setDate(pivot.getDate() - 7);
  return dateOnlyId(pivot);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }).format(date);
}

function nextDailyReset(now, timeStr) {
  const [hour, minute] = parseTime(timeStr);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function nextWeeklyReset(now, resetDay, timeStr) {
  const [hour, minute] = parseTime(timeStr);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  let daysUntil = (resetDay - now.getDay() + 7) % 7;
  if (daysUntil === 0 && next <= now) daysUntil = 7;
  next.setDate(now.getDate() + daysUntil);
  return next;
}

function renderResetLabels() {
  const now = new Date();
  els.dailyResetLabel.textContent = `Next reset: ${formatDateTime(nextDailyReset(now, state.settings.dailyResetTime))}`;
  els.weeklyResetLabel.textContent = `Next reset: ${formatDateTime(nextWeeklyReset(now, state.settings.weeklyResetDay, state.settings.weeklyResetTime))}`;
}

function parseTime(value) {
  const [h = "0", m = "0"] = value.split(":");
  return [Number(h), Number(m)];
}

function dateOnlyId(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ensurePersonTaskSet(taskSet) {
  if (!taskSet || typeof taskSet !== "object") return blankPersonTasks();
  return {
    p1: Array.isArray(taskSet.p1) ? taskSet.p1 : [],
    p2: Array.isArray(taskSet.p2) ? taskSet.p2 : [],
  };
}

function ensurePersonFilters(filters) {
  if (!filters || typeof filters !== "object") return blankPersonFilters();
  return {
    p1: filters.p1 === "finished" ? "finished" : "unfinished",
    p2: filters.p2 === "finished" ? "finished" : "unfinished",
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);

    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: {
        ...defaultState.settings,
        ...parsed.settings,
        people: {
          ...defaultState.settings.people,
          ...(parsed?.settings?.people || {}),
        },
      },
      periodIds: { ...defaultState.periodIds, ...parsed.periodIds },
      activePerson: {
        ...defaultState.activePerson,
        ...parsed.activePerson,
      },
      filters: {
        daily: ensurePersonFilters(parsed?.filters?.daily),
        weekly: ensurePersonFilters(parsed?.filters?.weekly),
        todo: ensurePersonFilters(parsed?.filters?.todo),
      },
      tasks: {
        daily: ensurePersonTaskSet(parsed?.tasks?.daily),
        weekly: ensurePersonTaskSet(parsed?.tasks?.weekly),
        todo: ensurePersonTaskSet(parsed?.tasks?.todo),
      },
      undoDelete: null,
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = `Auto-saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}