const STORAGE_KEY = "schedms-data-v2";
const LEGACY_STORAGE_KEY = "schedms-data-v1";
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

const defaultState = {
  settings: {
    resetTime: "00:00",
    weeklyResetDay: 3,
    timezoneOffset: "-08:00",
    people: { p1: "Player 1", p2: "Player 2" },
  },
  periodIds: { daily: "", weekly: "" },
  filters: { daily: "unfinished", weekly: "unfinished", todo: "unfinished" },
  activeOwner: { daily: "p1", weekly: "p1", todo: "p1" },
  tasks: { daily: [], weekly: [], todo: [] },
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
  ownerButtons: document.querySelectorAll(".owner-btn"),
  addForms: document.querySelectorAll(".add-task-form"),
  lists: {
    daily: { list: document.getElementById("daily-list"), empty: document.getElementById("daily-empty"), error: document.getElementById("daily-error") },
    weekly: { list: document.getElementById("weekly-list"), empty: document.getElementById("weekly-empty"), error: document.getElementById("weekly-error") },
    todo: { list: document.getElementById("todo-list"), empty: document.getElementById("todo-empty"), error: document.getElementById("todo-error") },
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
      const { list, filter } = tab.dataset;
      state.filters[list] = filter;
      saveState();
      renderAll();
    });
  });

  els.ownerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeOwner[btn.dataset.list] = btn.dataset.owner;
      saveState();
      renderAll();
    });
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { list } = form.dataset;
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (text.length < 3) {
        setFormError(list, "Task must be at least 3 characters.");
        return;
      }

      setFormError(list, "");
      state.tasks[list].push({
        id: crypto.randomUUID(),
        text,
        done: false,
        owner: state.activeOwner[list],
      });
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
    const { listType, task } = state.undoDelete;
    state.tasks[listType].push(task);
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
    renderList(listType);
    syncStatusTabs(listType);
    syncOwnerButtons(listType);
  });
  renderResetLabels();
  renderUndoButton();
  hydrateNameInputs();
}

function renderList(listType) {
  const taskSet = state.tasks[listType];
  const filter = state.filters[listType];
  const listEl = els.lists[listType].list;
  const emptyEl = els.lists[listType].empty;

  const unfinishedCount = taskSet.filter((task) => !task.done).length;
  const finishedCount = taskSet.length - unfinishedCount;
  updateTabCount(listType, unfinishedCount, finishedCount);

  const filtered = taskSet.filter((task) => (filter === "unfinished" ? !task.done : task.done));
  listEl.innerHTML = "";

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""} ${task.owner === "p1" ? "owner-p1" : "owner-p2"}`;

    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.addEventListener("change", () => {
      task.done = check.checked;
      saveState();
      renderAll();
    });

    const textWrap = document.createElement("span");
    textWrap.className = "task-text-wrap";

    const badge = document.createElement("small");
    badge.className = "owner-badge";
    badge.textContent = state.settings.people[task.owner] || (task.owner === "p1" ? "Player 1" : "Player 2");

    const text = document.createElement("span");
    text.textContent = task.text;

    textWrap.append(badge, text);
    label.append(check, textWrap);

    const del = document.createElement("button");
    del.textContent = "remove";
    del.className = "delete-btn";
    del.addEventListener("click", () => {
      state.tasks[listType] = state.tasks[listType].filter((item) => item.id !== task.id);
      state.undoDelete = { listType, task };
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
  const activeFilter = state.filters[listType];
  document.querySelectorAll(`.status-tab[data-list="${listType}"]`).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === activeFilter);
  });
}

function syncOwnerButtons(listType) {
  const activeOwner = state.activeOwner[listType];
  document.querySelectorAll(`.owner-btn[data-list="${listType}"]`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.owner === activeOwner);
    const label = state.settings.people[btn.dataset.owner] || (btn.dataset.owner === "p1" ? "Player 1" : "Player 2");
    btn.textContent = label;
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

function formatResetTime12h(timeStr) {
  const [h, m] = parseTime(timeStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function renderResetLabels() {
  const resetTime = formatResetTime12h(state.settings.resetTime);
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][state.settings.weeklyResetDay];

  els.dailyResetLabel.textContent = `Reset: ${resetTime}`;
  els.weeklyResetLabel.textContent = `Reset: ${resetTime} ${dayName}`;
}

function parseTime(value) {
  const [h = "0", m = "0"] = value.split(":");
  return [Number(h), Number(m)];
}

function normalizeTask(task, fallbackOwner = "p1") {
  if (!task || typeof task !== "object") return null;
  return {
    id: String(task.id || crypto.randomUUID()),
    text: String(task.text || "").trim(),
    done: Boolean(task.done),
    owner: task.owner === "p2" ? "p2" : fallbackOwner,
  };
}

function mergeLegacyTaskSets(taskSet) {
  if (Array.isArray(taskSet)) {
    return taskSet
      .map((task) => normalizeTask(task, task?.owner === "p2" ? "p2" : "p1"))
      .filter((task) => task && task.text.length > 0);
  }

  if (taskSet && typeof taskSet === "object") {
    const p1 = Array.isArray(taskSet.p1) ? taskSet.p1 : [];
    const p2 = Array.isArray(taskSet.p2) ? taskSet.p2 : [];
    return [
      ...p1.map((task) => normalizeTask(task, "p1")),
      ...p2.map((task) => normalizeTask(task, "p2")),
    ].filter((task) => task && task.text.length > 0);
  }

  return [];
}

function normalizeFilter(filter) {
  return filter === "finished" ? "finished" : "unfinished";
}

function normalizeActiveOwner(owner) {
  return owner === "p2" ? "p2" : "p1";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);

    const resetTime = parsed?.settings?.resetTime || parsed?.settings?.dailyResetTime || "00:00";

    const merged = {
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
        daily: normalizeFilter(parsed?.filters?.daily?.p1 || parsed?.filters?.daily),
        weekly: normalizeFilter(parsed?.filters?.weekly?.p1 || parsed?.filters?.weekly),
        todo: normalizeFilter(parsed?.filters?.todo?.p1 || parsed?.filters?.todo),
      },
      activeOwner: {
        daily: normalizeActiveOwner(parsed?.activeOwner?.daily),
        weekly: normalizeActiveOwner(parsed?.activeOwner?.weekly),
        todo: normalizeActiveOwner(parsed?.activeOwner?.todo),
      },
      tasks: {
        daily: mergeLegacyTaskSets(parsed?.tasks?.daily),
        weekly: mergeLegacyTaskSets(parsed?.tasks?.weekly),
        todo: mergeLegacyTaskSets(parsed?.tasks?.todo),
      },
      undoDelete: null,
    };

    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = `Auto-saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}