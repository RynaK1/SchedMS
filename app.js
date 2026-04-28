const STORAGE_KEY = "schedms-data-v1";
const LIST_TYPES = ["daily", "weekly", "todo"];
const PERSON_IDS = ["p1", "p2"];

const TIMEZONE_OPTIONS = [
  ["-12:00", "UTC-12 (AoE)"],
  ["-11:00", "UTC-11 (SST)"],
  ["-10:00", "UTC-10 (HST)"],
  ["-09:30", "UTC-9:30 (Marquesas)"],
  ["-09:00", "UTC-9 (AKST)"],
  ["-08:00", "UTC-8 (PST)"],
  ["-07:00", "UTC-7 (MST)"],
  ["-06:00", "UTC-6 (CST)"],
  ["-05:00", "UTC-5 (EST)"],
  ["-04:00", "UTC-4 (AST)"],
  ["-03:30", "UTC-3:30 (NST)"],
  ["-03:00", "UTC-3 (BRT)"],
  ["-02:00", "UTC-2 (South Georgia)"],
  ["-01:00", "UTC-1 (Azores)"],
  ["+00:00", "UTC+0 (GMT)"],
  ["+01:00", "UTC+1 (CET)"],
  ["+02:00", "UTC+2 (EET)"],
  ["+03:00", "UTC+3 (MSK)"],
  ["+03:30", "UTC+3:30 (IRST)"],
  ["+04:00", "UTC+4 (GST)"],
  ["+04:30", "UTC+4:30 (AFT)"],
  ["+05:00", "UTC+5 (PKT)"],
  ["+05:30", "UTC+5:30 (IST)"],
  ["+05:45", "UTC+5:45 (NPT)"],
  ["+06:00", "UTC+6 (BST)"],
  ["+06:30", "UTC+6:30 (MMT)"],
  ["+07:00", "UTC+7 (ICT)"],
  ["+08:00", "UTC+8 (AWST)"],
  ["+08:45", "UTC+8:45 (ACWST)"],
  ["+09:00", "UTC+9 (JST)"],
  ["+09:30", "UTC+9:30 (ACST)"],
  ["+10:00", "UTC+10 (AEST)"],
  ["+10:30", "UTC+10:30 (LHST)"],
  ["+11:00", "UTC+11 (SBT)"],
  ["+12:00", "UTC+12 (NZST/FJT)"],
  ["+12:45", "UTC+12:45 (CHAST)"],
  ["+13:00", "UTC+13 (NZDT/TOT)"],
  ["+14:00", "UTC+14 (LINT)"],
];

const blankPersonTasks = () => ({ p1: [], p2: [] });
const blankPersonFilters = () => ({ p1: "unfinished", p2: "unfinished" });

const defaultState = {
  settings: {
    resetTime: "00:00",
    weeklyResetDay: 3,
    timezoneOffset: "-08:00",
    people: { p1: "Player 1", p2: "Player 2" },
  },
  periodIds: { daily: "", weekly: "" },
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
  statusTabs: document.querySelectorAll(".status-tab"),
  addForms: document.querySelectorAll(".add-task-form"),
  lists: {
    daily: {
      p1: { list: document.getElementById("daily-p1-list"), empty: document.getElementById("daily-p1-empty"), error: document.getElementById("daily-p1-error") },
      p2: { list: document.getElementById("daily-p2-list"), empty: document.getElementById("daily-p2-empty"), error: document.getElementById("daily-p2-error") },
    },
    weekly: {
      p1: { list: document.getElementById("weekly-p1-list"), empty: document.getElementById("weekly-p1-empty"), error: document.getElementById("weekly-p1-error") },
      p2: { list: document.getElementById("weekly-p2-list"), empty: document.getElementById("weekly-p2-empty"), error: document.getElementById("weekly-p2-error") },
    },
    todo: {
      p1: { list: document.getElementById("todo-p1-list"), empty: document.getElementById("todo-p1-empty"), error: document.getElementById("todo-p1-error") },
      p2: { list: document.getElementById("todo-p2-list"), empty: document.getElementById("todo-p2-empty"), error: document.getElementById("todo-p2-error") },
    },
  },
  titleEls: {
    "todo-p1": document.getElementById("todo-p1-title"),
    "todo-p2": document.getElementById("todo-p2-title"),
    "daily-p1": document.getElementById("daily-p1-title"),
    "daily-p2": document.getElementById("daily-p2-title"),
    "weekly-p1": document.getElementById("weekly-p1-title"),
    "weekly-p2": document.getElementById("weekly-p2-title"),
  },
  dailyResetLabel: document.getElementById("daily-reset-label"),
  weeklyResetLabel: document.getElementById("weekly-reset-label"),
  resetTime: document.getElementById("reset-time"),
  weeklyResetDay: document.getElementById("weekly-reset-day"),
  timezoneOffset: document.getElementById("timezone-offset"),
  person1Name: document.getElementById("person1-name"),
  person2Name: document.getElementById("person2-name"),
  saveStatus: document.getElementById("save-status"),
  undoDelete: document.getElementById("undo-delete"),
};

initialize();

function initialize() {
  populateTimezoneOptions();
  hydrateSettingsUI();
  runResetsIfNeeded();
  wireEvents();
  wireRealtimeSync();
  renderAll();
}

function populateTimezoneOptions() {
  TIMEZONE_OPTIONS.forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    els.timezoneOffset.appendChild(opt);
  });
}

function wireEvents() {
  els.topTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));

  els.statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const { list, person, filter } = tab.dataset;
      state.filters[list][person] = filter;
      saveState();
      renderAll();
    });
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { list, person } = form.dataset;
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (text.length < 3) {
        setFormError(list, person, "Task must be at least 3 characters.");
        return;
      }

      setFormError(list, person, "");
      state.tasks[list][person].push({ id: crypto.randomUUID(), text, done: false });
      input.value = "";
      saveState();
      renderAll();
    });
  });

  els.resetTime.addEventListener("change", () => {
    state.settings.resetTime = els.resetTime.value || "00:00";
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

  els.timezoneOffset.addEventListener("change", () => {
    state.settings.timezoneOffset = els.timezoneOffset.value;
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

function wireRealtimeSync() {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      state = mergeLoadedState(JSON.parse(event.newValue));
      renderAll();
    } catch {
      // Ignore malformed storage writes.
    }
  });
}

function updatePersonName(personId, value) {
  const clean = value.trim();
  state.settings.people[personId] = clean || (personId === "p1" ? "Player 1" : "Player 2");
  saveState();
  renderAll();
}

function setFormError(listType, personId, message) {
  els.lists[listType][personId].error.textContent = message;
}

function switchView(viewName) {
  Object.entries(els.views).forEach(([name, section]) => section.classList.toggle("active", name === viewName));
  els.topTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
}

function renderAll() {
  LIST_TYPES.forEach((listType) => {
    PERSON_IDS.forEach((personId) => {
      renderList(listType, personId);
      syncStatusTabs(listType, personId);
      renderPersonTitle(listType, personId);
    });
  });
  renderResetLabels();
  renderUndoButton();
  hydrateNameInputs();
}

function renderPersonTitle(listType, personId) {
  els.titleEls[`${listType}-${personId}`].textContent = state.settings.people[personId];
}

function renderList(listType, personId) {
  const taskSet = state.tasks[listType][personId];
  const filter = state.filters[listType][personId];
  const listEl = els.lists[listType][personId].list;
  const emptyEl = els.lists[listType][personId].empty;

  const unfinishedCount = taskSet.filter((task) => !task.done).length;
  const finishedCount = taskSet.length - unfinishedCount;
  updateTabCount(listType, personId, unfinishedCount, finishedCount);

  const filtered = taskSet.filter((task) => (filter === "unfinished" ? !task.done : task.done));
  listEl.innerHTML = "";

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""}`;

    const label = document.createElement("label");
    label.className = "task-main";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.addEventListener("change", () => {
      task.done = check.checked;
      saveState();
      renderAll();
    });

    const text = document.createElement("span");
    text.className = "task-copy";
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

function updateTabCount(listType, personId, unfinishedCount, finishedCount) {
  document.querySelector(`.status-tab[data-list="${listType}"][data-person="${personId}"][data-filter="unfinished"]`).textContent = `Unfinished (${unfinishedCount})`;
  document.querySelector(`.status-tab[data-list="${listType}"][data-person="${personId}"][data-filter="finished"]`).textContent = `Finished (${finishedCount})`;
}

function syncStatusTabs(listType, personId) {
  const activeFilter = state.filters[listType][personId];
  document.querySelectorAll(`.status-tab[data-list="${listType}"][data-person="${personId}"]`).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === activeFilter);
  });
}

function renderUndoButton() {
  els.undoDelete.disabled = !Boolean(state.undoDelete);
}

function hydrateSettingsUI() {
  els.resetTime.value = state.settings.resetTime;
  els.weeklyResetDay.value = String(state.settings.weeklyResetDay);
  els.timezoneOffset.value = state.settings.timezoneOffset;
  hydrateNameInputs();
}

function hydrateNameInputs() {
  els.person1Name.value = state.settings.people.p1;
  els.person2Name.value = state.settings.people.p2;
}

function runResetsIfNeeded() {
  const now = new Date();
  const nextDailyPeriodId = dailyPeriodId(now, state.settings.resetTime, state.settings.timezoneOffset);
  const nextWeeklyPeriodId = weeklyPeriodId(
    now,
    state.settings.weeklyResetDay,
    state.settings.resetTime,
    state.settings.timezoneOffset
  );

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

function parseOffsetToMinutes(offset) {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [h, m] = offset.replace("+", "").replace("-", "").split(":").map(Number);
  return sign * (h * 60 + m);
}

function toTimezoneDate(date, offset) {
  return new Date(date.getTime() + parseOffsetToMinutes(offset) * 60000);
}

function formatDateParts(dateObj) {
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dailyPeriodId(now, timeStr, offset) {
  const tzNow = toTimezoneDate(now, offset);
  const [hour, minute] = parseTime(timeStr);
  const pivot = new Date(tzNow);
  pivot.setUTCHours(hour, minute, 0, 0);
  if (tzNow < pivot) pivot.setUTCDate(pivot.getUTCDate() - 1);
  return formatDateParts(pivot);
}

function weeklyPeriodId(now, resetDay, timeStr, offset) {
  const tzNow = toTimezoneDate(now, offset);
  const [hour, minute] = parseTime(timeStr);
  const pivot = new Date(tzNow);
  pivot.setUTCHours(hour, minute, 0, 0);
  const diffDays = (tzNow.getUTCDay() - resetDay + 7) % 7;
  pivot.setUTCDate(tzNow.getUTCDate() - diffDays);
  if (diffDays === 0 && tzNow < pivot) pivot.setUTCDate(pivot.getUTCDate() - 7);
  return formatDateParts(pivot);
}

function nextDailyReset(now, timeStr, offset) {
  const tzNow = toTimezoneDate(now, offset);
  const [hour, minute] = parseTime(timeStr);
  const next = new Date(tzNow);
  next.setUTCHours(hour, minute, 0, 0);
  if (next <= tzNow) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function nextWeeklyReset(now, resetDay, timeStr, offset) {
  const tzNow = toTimezoneDate(now, offset);
  const [hour, minute] = parseTime(timeStr);
  const next = new Date(tzNow);
  next.setUTCHours(hour, minute, 0, 0);
  let daysUntil = (resetDay - tzNow.getUTCDay() + 7) % 7;
  if (daysUntil === 0 && next <= tzNow) daysUntil = 7;
  next.setUTCDate(tzNow.getUTCDate() + daysUntil);
  return next;
}

function renderResetLabels() {
  const now = new Date();
  const offset = state.settings.timezoneOffset;
  const tzLabel = `UTC${offset}`;
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][state.settings.weeklyResetDay];

  const d = nextDailyReset(now, state.settings.resetTime, offset);
  const w = nextWeeklyReset(now, state.settings.weeklyResetDay, state.settings.resetTime, offset);

  els.dailyResetLabel.textContent = `Next: ${formatDateParts(d)} ${state.settings.resetTime} (${tzLabel})`;
  els.weeklyResetLabel.textContent = `Next: ${dayName} ${formatDateParts(w)} ${state.settings.resetTime} (${tzLabel})`;
}

function parseTime(value) {
  const [h = "0", m = "0"] = value.split(":");
  return [Number(h), Number(m)];
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
    return mergeLoadedState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function mergeLoadedState(parsed) {
  const resetTime = parsed?.settings?.resetTime || parsed?.settings?.dailyResetTime || "00:00";

  return {
    ...structuredClone(defaultState),
    ...parsed,
    settings: {
      ...defaultState.settings,
      ...parsed.settings,
      resetTime,
      timezoneOffset: parsed?.settings?.timezoneOffset || "-08:00",
      people: {
        ...defaultState.settings.people,
        ...(parsed?.settings?.people || {}),
      },
    },
    periodIds: { ...defaultState.periodIds, ...parsed.periodIds },
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
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = `Auto-saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}