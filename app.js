const STORAGE_KEY = "rounday-events-v2";
const LEGACY_STORAGE_KEY = "rounday-events-v1";
const palette = ["#e35d4f", "#f3ad3e", "#246b5f", "#3078b8", "#7d5cc6", "#2f9f9b", "#d85d90"];

const defaultEvents = [
  { id: crypto.randomUUID(), title: "수면", start: "00:00", end: "07:00", type: "rest", color: "#7d5cc6" },
  { id: crypto.randomUUID(), title: "아침 루틴", start: "07:00", end: "08:00", type: "life", color: "#f3ad3e" },
  { id: crypto.randomUUID(), title: "집중 작업", start: "09:00", end: "12:00", type: "focus", color: "#246b5f" },
  { id: crypto.randomUUID(), title: "점심", start: "12:00", end: "13:00", type: "life", color: "#e35d4f" },
  { id: crypto.randomUUID(), title: "학습", start: "15:00", end: "17:00", type: "learn", color: "#3078b8" },
  { id: crypto.randomUUID(), title: "운동", start: "18:30", end: "19:30", type: "health", color: "#2f9f9b" },
];

const templates = {
  student: [
    ["수면", "00:00", "07:00", "rest", "#7d5cc6"],
    ["등교 준비", "07:00", "08:00", "life", "#f3ad3e"],
    ["수업", "09:00", "15:00", "learn", "#3078b8"],
    ["과제", "16:00", "18:00", "focus", "#246b5f"],
    ["운동", "19:00", "20:00", "health", "#2f9f9b"],
    ["휴식", "21:00", "23:00", "rest", "#d85d90"],
  ],
  maker: [
    ["수면", "00:30", "07:30", "rest", "#7d5cc6"],
    ["기획", "08:30", "10:00", "focus", "#246b5f"],
    ["제작", "10:00", "13:00", "focus", "#e35d4f"],
    ["회고", "14:00", "15:00", "learn", "#3078b8"],
    ["실험", "15:00", "18:00", "focus", "#f3ad3e"],
    ["산책", "19:00", "20:00", "health", "#2f9f9b"],
  ],
};

let state = loadState();
let events = activeProfile().events;
let selectedColor = palette[0];
let activeEventId = "";
let draftSelection = null;
let dragState = null;

const $ = (selector) => document.querySelector(selector);
const clockSvg = $("#clockSvg");
const form = $("#eventForm");
const formError = $("#formError");

function cloneEvents(source) {
  return source.map((event) => ({ ...event, id: crypto.randomUUID(), repeat: Boolean(event.repeat) }));
}

function createProfile(name, source = []) {
  return {
    id: crypto.randomUUID(),
    name,
    events: cloneEvents(source),
  };
}

function normalizeEvent(event) {
  return {
    id: typeof event.id === "string" ? event.id : crypto.randomUUID(),
    title: typeof event.title === "string" ? event.title.slice(0, 28) : "새 일정",
    start: typeof event.start === "string" ? event.start : "09:00",
    end: typeof event.end === "string" ? event.end : "10:00",
    type: ["focus", "health", "life", "learn", "rest"].includes(event.type) ? event.type : "focus",
    color: palette.includes(event.color) ? event.color : palette[0],
    repeat: Boolean(event.repeat),
  };
}

function normalizeState(candidate) {
  if (Array.isArray(candidate)) {
    const profile = createProfile("기본 하루", candidate.map(normalizeEvent));
    return { activeProfileId: profile.id, profiles: [profile] };
  }

  const profiles = Array.isArray(candidate?.profiles)
    ? candidate.profiles.map((profile, index) => ({
        id: typeof profile.id === "string" ? profile.id : crypto.randomUUID(),
        name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim().slice(0, 24) : `프로필 ${index + 1}`,
        events: Array.isArray(profile.events) ? profile.events.map(normalizeEvent) : [],
      }))
    : [];

  if (!profiles.length) {
    const profile = createProfile("기본 하루", defaultEvents);
    return { activeProfileId: profile.id, profiles: [profile] };
  }

  const activeProfileId = profiles.some((profile) => profile.id === candidate?.activeProfileId) ? candidate.activeProfileId : profiles[0].id;
  return { activeProfileId, profiles };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw && legacy) {
    try {
      return normalizeState(JSON.parse(legacy));
    } catch {
      return normalizeState(null);
    }
  }
  if (!raw) return normalizeState(null);
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState(null);
  }
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
}

function syncActiveEvents() {
  events = activeProfile().events;
}

function setEvents(nextEvents) {
  activeProfile().events = nextEvents;
  syncActiveEvents();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToLabel(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60).toString().padStart(2, "0");
  const m = (normalized % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function durationOf(event) {
  const start = timeToMinutes(event.start);
  const end = timeToMinutes(event.end);
  return end > start ? end - start : 1440 - start + end;
}

function polar(cx, cy, radius, minutes) {
  const angle = (minutes / 1440) * 360 - 90;
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function arcPath(cx, cy, radius, startMinutes, endMinutes) {
  const start = polar(cx, cy, radius, startMinutes);
  const end = polar(cx, cy, radius, endMinutes);
  const diff = (endMinutes - startMinutes + 1440) % 1440 || 1440;
  const largeArc = diff > 720 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function snapMinutes(minutes, step = 15) {
  return Math.round(minutes / step) * step;
}

function pointToMinutes(clientX, clientY) {
  const rect = clockSvg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 620 - 310;
  const y = ((clientY - rect.top) / rect.height) * 620 - 310;
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return ((snapMinutes(((degrees + 90 + 360) % 360) * 4) % 1440) + 1440) % 1440;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function renderClock() {
  clockSvg.replaceChildren();
  clockSvg.appendChild(svgEl("circle", { cx: 310, cy: 310, r: 250, fill: "#fffefa", stroke: "#d9d6ca", "stroke-width": 2 }));
  clockSvg.appendChild(svgEl("circle", { cx: 310, cy: 310, r: 196, fill: "none", stroke: "#ece8dc", "stroke-width": 1 }));

  for (let hour = 0; hour < 24; hour += 1) {
    const minutes = hour * 60;
    const outer = polar(310, 310, 270, minutes);
    const inner = polar(310, 310, hour % 3 === 0 ? 244 : 252, minutes);
    const tick = svgEl("line", {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      class: `tick ${hour % 3 === 0 ? "major" : "minor"}`,
    });
    clockSvg.appendChild(tick);

    if (hour % 3 === 0) {
      const labelPoint = polar(310, 310, 226, minutes);
      const label = svgEl("text", { x: labelPoint.x, y: labelPoint.y, class: "clock-label" });
      label.textContent = `${hour}`;
      clockSvg.appendChild(label);
    }
  }

  [...events].sort(sortByStart).forEach((event) => {
    const start = timeToMinutes(event.start);
    const end = timeToMinutes(event.end);
    const path = svgEl("path", {
      d: arcPath(310, 310, 218, start, end),
      class: "event-arc",
      stroke: event.color,
      "stroke-width": 38,
      "data-id": event.id,
    });
    if (event.id === activeEventId) path.classList.add("active");
    path.addEventListener("pointerdown", (pointerEvent) => pointerEvent.stopPropagation());
    path.addEventListener("click", () => editEvent(event.id));
    clockSvg.appendChild(path);
  });

  if (draftSelection) {
    clockSvg.appendChild(
      svgEl("path", {
        d: arcPath(310, 310, 218, draftSelection.start, draftSelection.end),
        class: "draft-arc",
        stroke: selectedColor,
        "stroke-width": 46,
      }),
    );
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const inner = polar(310, 310, 82, nowMinutes);
  const outer = polar(310, 310, 278, nowMinutes);
  clockSvg.appendChild(svgEl("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "now-line" }));
  clockSvg.appendChild(svgEl("circle", { cx: outer.x, cy: outer.y, r: 6, class: "now-dot" }));
}

function sortByStart(a, b) {
  return timeToMinutes(a.start) - timeToMinutes(b.start);
}

function detectConflicts() {
  const segments = events.flatMap((event) => {
    const start = timeToMinutes(event.start);
    const end = timeToMinutes(event.end);
    return end > start
      ? [{ id: event.id, start, end }]
      : [
          { id: event.id, start, end: 1440 },
          { id: event.id, start: 0, end },
        ];
  });

  const conflicts = new Set();
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (segments[i].id !== segments[j].id && segments[i].start < segments[j].end && segments[j].start < segments[i].end) {
        conflicts.add(segments[i].id);
        conflicts.add(segments[j].id);
      }
    }
  }
  return conflicts;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function renderTimeline() {
  const list = $("#timelineList");
  const conflicts = detectConflicts();
  $("#conflictBadge").classList.toggle("hidden", conflicts.size === 0);
  list.replaceChildren();

  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty";
    empty.textContent = "아직 일정이 없습니다.";
    list.appendChild(empty);
    return;
  }

  [...events].sort(sortByStart).forEach((event) => {
    const card = document.createElement("article");
    card.className = `event-card ${event.id === activeEventId ? "active" : ""}`;
    card.tabIndex = 0;
    card.dataset.card = event.id;
    card.style.setProperty("--event-color", event.color);
    card.innerHTML = `
      <div class="event-strip"></div>
      <div>
        <h3>${escapeHtml(event.title)}${conflicts.has(event.id) ? " · 겹침" : ""}</h3>
        <p>${event.start} - ${event.end} · ${formatDuration(durationOf(event))}${event.repeat ? " · 반복" : ""}</p>
      </div>
      <div class="card-actions">
        <button class="icon-button" type="button" aria-label="일정 편집" data-edit="${event.id}"><i data-lucide="pencil"></i></button>
        <button class="icon-button" type="button" aria-label="일정 삭제" data-delete="${event.id}"><i data-lucide="trash-2"></i></button>
      </div>
    `;
    list.appendChild(card);
  });

  document.querySelectorAll("[data-card]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      editEvent(card.dataset.card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      editEvent(card.dataset.card);
    });
  });
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editEvent(button.dataset.edit));
  });
  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteEvent(button.dataset.delete));
  });
  refreshIcons();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function renderStats() {
  const planned = events.reduce((sum, event) => sum + durationOf(event), 0);
  const capped = Math.min(planned, 1440);
  const percent = Math.round((capped / 1440) * 100);
  $("#completionText").textContent = `${percent}%`;
  $("#progressFill").style.width = `${percent}%`;
  $("#plannedHours").textContent = formatDuration(planned);
  $("#freeHours").textContent = formatDuration(Math.max(0, 1440 - planned));
  $("#blockCount").textContent = events.length;
}

function renderSwatches() {
  const swatches = $("#swatches");
  swatches.replaceChildren();
  palette.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `swatch ${color === selectedColor ? "active" : ""}`;
    button.style.setProperty("--swatch", color);
    button.setAttribute("aria-label", `${color} 선택`);
    button.addEventListener("click", () => {
      selectedColor = color;
      renderSwatches();
    });
    swatches.appendChild(button);
  });
}

function renderProfileControls() {
  const profile = activeProfile();
  const select = $("#profileSelect");
  select.replaceChildren();
  state.profiles.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    option.selected = item.id === profile.id;
    select.appendChild(option);
  });
  $("#profileNameInput").value = profile.name;
  $("#deleteProfileBtn").disabled = state.profiles.length < 2;
}

function renderAll() {
  saveState();
  renderProfileControls();
  renderClock();
  renderTimeline();
  renderStats();
  updateCurrentTime();
  refreshIcons();
}

function applyClockSelection(start, end) {
  const normalizedEnd = start === end ? (start + 60) % 1440 : end;
  $("#eventId").value = "";
  $("#startInput").value = minutesToLabel(start);
  $("#endInput").value = minutesToLabel(normalizedEnd);
  $("#repeatInput").checked = false;
  $("#formTitle").textContent = "일정 추가";
  $("#submitText").textContent = "추가하기";
  $("#cancelEdit").classList.remove("hidden");
  activeEventId = "";
  draftSelection = null;
  formError.textContent = "";
  renderClock();
  renderTimeline();
}

function validateEvent(data) {
  if (!data.title.trim()) return "일정 이름을 입력하세요.";
  if (!/^\d{2}:\d{2}$/.test(data.start) || !/^\d{2}:\d{2}$/.test(data.end)) return "시간 형식이 올바르지 않습니다.";
  if (!palette.includes(data.color)) return "사용할 수 없는 색상입니다.";
  if (data.start === data.end) return "시작과 종료 시간이 같을 수 없습니다.";
  if (durationOf(data) < 15) return "15분 이상으로 입력하세요.";
  if (durationOf(data) > 960) return "하나의 일정은 16시간 이하로 입력하세요.";
  return "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#eventId").value || crypto.randomUUID();
  const data = {
    id,
    title: $("#titleInput").value.trim(),
    start: $("#startInput").value,
    end: $("#endInput").value,
    type: $("#typeInput").value,
    color: selectedColor,
    repeat: $("#repeatInput").checked,
  };
  const error = validateEvent(data);
  formError.textContent = error;
  if (error) return;

  const existing = events.findIndex((item) => item.id === id);
  if (existing >= 0) events[existing] = data;
  else events.push(data);
  setEvents(events);
  resetForm();
  renderAll();
});

function editEvent(id) {
  const event = events.find((item) => item.id === id);
  if (!event) return;
  $("#eventId").value = event.id;
  $("#titleInput").value = event.title;
  $("#startInput").value = event.start;
  $("#endInput").value = event.end;
  $("#typeInput").value = event.type;
  $("#repeatInput").checked = Boolean(event.repeat);
  selectedColor = event.color;
  activeEventId = id;
  draftSelection = null;
  $("#formTitle").textContent = "일정 수정";
  $("#submitText").textContent = "수정하기";
  $("#cancelEdit").classList.remove("hidden");
  formError.textContent = "";
  renderSwatches();
  renderClock();
  renderTimeline();
}

function deleteEvent(id) {
  setEvents(events.filter((event) => event.id !== id));
  resetForm();
  renderAll();
}

function resetForm() {
  form.reset();
  $("#eventId").value = "";
  $("#startInput").value = "09:00";
  $("#endInput").value = "10:00";
  $("#repeatInput").checked = false;
  selectedColor = palette[0];
  activeEventId = "";
  draftSelection = null;
  $("#formTitle").textContent = "일정 추가";
  $("#submitText").textContent = "추가하기";
  $("#cancelEdit").classList.add("hidden");
  formError.textContent = "";
  renderSwatches();
  renderClock();
  renderTimeline();
}

function applyTemplate(name) {
  if (name === "reset") {
    setEvents([]);
  } else {
    setEvents(templates[name].map(([title, start, end, type, color]) => ({
      id: crypto.randomUUID(),
      title,
      start,
      end,
      type,
      color,
      repeat: true,
    })));
  }
  resetForm();
  renderAll();
}

function addProfile() {
  const next = createProfile(`프로필 ${state.profiles.length + 1}`, events);
  state.profiles.push(next);
  state.activeProfileId = next.id;
  syncActiveEvents();
  resetForm();
  renderAll();
}

function deleteProfile() {
  if (state.profiles.length < 2) return;
  state.profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
  state.activeProfileId = state.profiles[0].id;
  syncActiveEvents();
  resetForm();
  renderAll();
}

function renameActiveProfile(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  activeProfile().name = trimmed.slice(0, 24);
  renderAll();
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      syncActiveEvents();
      resetForm();
      renderAll();
    } catch {
      formError.textContent = "JSON 파일을 읽을 수 없습니다.";
    } finally {
      $("#importInput").value = "";
    }
  });
  reader.readAsText(file);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rounday-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function updateCurrentTime() {
  const now = new Date();
  $("#currentTime").textContent = minutesToLabel(now.getHours() * 60 + now.getMinutes());
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

document.querySelectorAll("[data-template]").forEach((button) => {
  button.addEventListener("click", () => applyTemplate(button.dataset.template));
});

$("#downloadBtn").addEventListener("click", downloadJson);
$("#resetBtn").addEventListener("click", () => {
  setEvents(cloneEvents(defaultEvents));
  resetForm();
  renderAll();
});
$("#cancelEdit").addEventListener("click", resetForm);
$("#addProfileBtn").addEventListener("click", addProfile);
$("#deleteProfileBtn").addEventListener("click", deleteProfile);
$("#profileSelect").addEventListener("change", (event) => {
  state.activeProfileId = event.target.value;
  syncActiveEvents();
  resetForm();
  renderAll();
});
$("#profileNameInput").addEventListener("change", (event) => renameActiveProfile(event.target.value));
$("#importBtn").addEventListener("click", () => $("#importInput").click());
$("#importInput").addEventListener("change", (event) => importJson(event.target.files[0]));

clockSvg.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".event-arc")) return;
  const start = pointToMinutes(event.clientX, event.clientY);
  dragState = { start, pointerId: event.pointerId };
  draftSelection = { start, end: (start + 60) % 1440 };
  clockSvg.setPointerCapture(event.pointerId);
  renderClock();
});

clockSvg.addEventListener("pointermove", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const end = pointToMinutes(event.clientX, event.clientY);
  draftSelection = { start: dragState.start, end: end === dragState.start ? (end + 60) % 1440 : end };
  renderClock();
});

clockSvg.addEventListener("pointerup", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const end = pointToMinutes(event.clientX, event.clientY);
  const start = dragState.start;
  dragState = null;
  clockSvg.releasePointerCapture(event.pointerId);
  applyClockSelection(start, end);
});

clockSvg.addEventListener("pointercancel", () => {
  dragState = null;
  draftSelection = null;
  renderClock();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    resetForm();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    form.requestSubmit();
  }
});

resetForm();
renderAll();
setInterval(() => {
  renderClock();
  updateCurrentTime();
}, 60_000);
