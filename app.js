const STORAGE_KEY = "schedms-data-v1";
const LIST_TYPES = ["daily", "weekly", "todo"];

const defaultState = {
  settings: {
    dailyResetTime: "00:00",
    weeklyResetDay: 3,
    weeklyResetTime: "00:00",
  },
  periodIds: {
    daily: "",
    weekly: "",
  },
  filters: {
    daily: "unfinished",
    weekly: "unfinished",
    todo: "unfinished",
  },
  tasks: {
    daily: [],
    weekly: [],
    todo: [],
  },
};

let state = loadState();

const els = {
  views: {
    lists: document.getElementById("lists-view"),
    options: document.getElementById("options-view"),
  },
  topTabs: document.querySelectorAll(".top-tab"),
  statusTabs: document.querySelectorAll(".status-tab"),
  addForms: document.querySelectorAll(".add-task-form"),
  lists: {
    daily: {
      list: document.getElementById("daily-task-list"),
      empty: document.getElementById("daily-empty"),
    },
    weekly: {
      list: document.getElementById("weekly-task-list"),
      empty: document.getElementById("weekly-empty"),
    },
    todo: {
      list: document.getElementById("todo-task-list"),
      empty: document.getElementById("todo-empty"),
    },
  },
  dailyResetLabel: document.getElementById("daily-reset-label"),
  weeklyResetLabel: document.getElementById("weekly-reset-label"),
  dailyResetTime: document.getElementById("daily-reset-time"),
  weeklyResetDay: document.getElementById("weekly-reset-day"),
  weeklyResetTime: document.getElementById("weekly-reset-time"),
};

initialize();

function initialize() {
  hydrateSettingsUI();
  runResetsIfNeeded();
  wireEvents();
  renderAll();
}

function wireEvents() {
  els.topTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const listType = tab.dataset.list;
      state.filters[listType] = tab.dataset.filter;
      saveState();
      renderList(listType);
      syncStatusTabs(listType);
    });
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const listType = form.dataset.list;
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;

      state.tasks[listType].push({
        id: crypto.randomUUID(),
        text,
        done: false,
      });

      input.value = "";
      saveState();
      renderList(listType);
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
}

function switchView(viewName) {
  Object.entries(els.views).forEach(([name, section]) => {
    section.classList.toggle("active", name === viewName);
  });

  els.topTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
}

function renderAll() {
  LIST_TYPES.forEach((listType) => {
    renderList(listType);
    syncStatusTabs(listType);
  });
  renderResetLabels();
}

function renderList(listType) {
  const listEl = els.lists[listType].list;
  const emptyEl = els.lists[listType].empty;
  const filter = state.filters[listType];
  const filtered = state.tasks[listType].filter((task) =>
    filter === "unfinished" ? !task.done : task.done
  );

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
      renderList(listType);
    });

    const text = document.createElement("span");
    text.textContent = task.text;
    label.append(check, text);

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "delete-btn";
    del.addEventListener("click", () => {
      state.tasks[listType] = state.tasks[listType].filter((item) => item.id !== task.id);
      saveState();
      renderList(listType);
    });

    li.append(label, del);
    listEl.appendChild(li);
  });

  emptyEl.style.display = filtered.length === 0 ? "block" : "none";
}

function syncStatusTabs(listType) {
  const activeFilter = state.filters[listType];
  document
    .querySelectorAll(`.status-tab[data-list="${listType}"]`)
    .forEach((tab) => tab.classList.toggle("active", tab.dataset.filter === activeFilter));
}

function hydrateSettingsUI() {
  els.dailyResetTime.value = state.settings.dailyResetTime;
  els.weeklyResetDay.value = String(state.settings.weeklyResetDay);
  els.weeklyResetTime.value = state.settings.weeklyResetTime;
}

function runResetsIfNeeded() {
  const now = new Date();
  const nextDailyPeriodId = dailyPeriodId(now, state.settings.dailyResetTime);
  const nextWeeklyPeriodId = weeklyPeriodId(
    now,
    state.settings.weeklyResetDay,
    state.settings.weeklyResetTime
  );

  if (state.periodIds.daily !== nextDailyPeriodId) {
    state.periodIds.daily = nextDailyPeriodId;
    state.tasks.daily = state.tasks.daily.map((task) => ({ ...task, done: false }));
    state.filters.daily = "unfinished";
  }

  if (state.periodIds.weekly !== nextWeeklyPeriodId) {
    state.periodIds.weekly = nextWeeklyPeriodId;
    state.tasks.weekly = state.tasks.weekly.map((task) => ({ ...task, done: false }));
    state.filters.weekly = "unfinished";
  }

  saveState();
}

function dailyPeriodId(now, timeStr) {
  const [hour, minute] = parseTime(timeStr);
  const pivot = new Date(now);
  pivot.setHours(hour, minute, 0, 0);

  if (now < pivot) {
    pivot.setDate(pivot.getDate() - 1);
  }

  return dateOnlyId(pivot);
}

function weeklyPeriodId(now, resetDay, timeStr) {
  const [hour, minute] = parseTime(timeStr);
  const pivot = new Date(now);
  pivot.setHours(hour, minute, 0, 0);

  const diffDays = (now.getDay() - resetDay + 7) % 7;
  pivot.setDate(now.getDate() - diffDays);

  const sameDayBeforeReset = diffDays === 0 && now < pivot;
  if (sameDayBeforeReset) {
    pivot.setDate(pivot.getDate() - 7);
  }

  return dateOnlyId(pivot);
}

function renderResetLabels() {
  const weekday = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][state.settings.weeklyResetDay];

  els.dailyResetLabel.textContent = `Resets daily at ${state.settings.dailyResetTime}`;
  els.weeklyResetLabel.textContent = `Resets ${weekday} at ${state.settings.weeklyResetTime}`;
}

function parseTime(value) {
  const [h = "0", m = "0"] = value.split(":");
  return [Number(h), Number(m)];
}

function dateOnlyId(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);

    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...parsed.settings },
      periodIds: { ...defaultState.periodIds, ...parsed.periodIds },
      filters: { ...defaultState.filters, ...parsed.filters },
      tasks: {
        daily: Array.isArray(parsed?.tasks?.daily) ? parsed.tasks.daily : [],
        weekly: Array.isArray(parsed?.tasks?.weekly) ? parsed.tasks.weekly : [],
        todo: Array.isArray(parsed?.tasks?.todo) ? parsed.tasks.todo : [],
      },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}