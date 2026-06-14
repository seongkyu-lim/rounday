const STORAGE_KEY = "rounday-events-v2";
const LEGACY_STORAGE_KEY = "rounday-events-v1";
const SCHEMA_VERSION = 2;
const GITHUB_TOKEN_KEY = "rounday-github-token";
const GITHUB_PKCE_KEY = "rounday-github-pkce";
const GITHUB_CONFIG_KEY = "rounday-github-config";
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

let state;
let events;
let selectedColor = palette[0];
let activeEventId = "";
let draftSelection = null;
let dragState = null;
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const clockSvg = $("#clockSvg");
const form = $("#eventForm");
const formError = $("#formError");
const storageAdapter = {
  load() {
    return localStorage.getItem(STORAGE_KEY);
  },
  loadLegacy() {
    return localStorage.getItem(LEGACY_STORAGE_KEY);
  },
  save(nextState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return { provider: "local", savedAt: nextState.updatedAt };
  },
};
let lastSave = null;
state = loadSharedState() || loadState();
events = activeProfile().events;

function getGithubConfig() {
  try {
    return JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveGithubConfig(config) {
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(config));
}

function getGithubToken() {
  return sessionStorage.getItem(GITHUB_TOKEN_KEY);
}

function base64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function randomString(length = 64) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function base64Json(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2))));
}

function parseBase64Json(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

async function githubRequest(path, options = {}) {
  const token = getGithubToken();
  if (!token) throw new Error("GitHub 로그인이 필요합니다.");
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "GitHub API 요청에 실패했습니다.");
  return body;
}

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
    return createState([profile], profile.id);
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
    return createState([profile], profile.id);
  }

  const activeProfileId = profiles.some((profile) => profile.id === candidate?.activeProfileId) ? candidate.activeProfileId : profiles[0].id;
  return createState(profiles, activeProfileId, candidate);
}

function createState(profiles, activeProfileId, source = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    userId: typeof source.userId === "string" ? source.userId : null,
    account: source.account
      ? {
          email: typeof source.account.email === "string" ? source.account.email : "",
          signedInAt: typeof source.account.signedInAt === "string" ? source.account.signedInAt : null,
        }
      : null,
    activeProfileId,
    profiles,
    templates: Array.isArray(source.templates)
      ? source.templates.map((template, index) => ({
          id: typeof template.id === "string" ? template.id : crypto.randomUUID(),
          name: typeof template.name === "string" && template.name.trim() ? template.name.trim().slice(0, 24) : `템플릿 ${index + 1}`,
          events: Array.isArray(template.events) ? template.events.map(normalizeEvent) : [],
        }))
      : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    sync: {
      provider: source.sync?.provider || "local",
      lastSyncedAt: source.sync?.lastSyncedAt || null,
    },
  };
}

function loadState() {
  const raw = storageAdapter.load();
  const legacy = storageAdapter.loadLegacy();
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
  state.updatedAt = new Date().toISOString();
  lastSave = storageAdapter.save(state);
}

function encodeSharePayload(profile) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(profile))));
}

function decodeSharePayload(payload) {
  return JSON.parse(decodeURIComponent(escape(atob(payload))));
}

function loadSharedState() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const payload = hash.get("share");
  if (!payload) return null;
  try {
    const profile = createProfile("공유 일정", decodeSharePayload(payload).events || []);
    return createState([profile], profile.id, { sync: { provider: "shared" } });
  } catch {
    return null;
  }
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

function getFreeSlots() {
  const busy = events
    .flatMap((event) => {
      const start = timeToMinutes(event.start);
      const end = timeToMinutes(event.end);
      return end > start
        ? [{ start, end }]
        : [
            { start, end: 1440 },
            { start: 0, end },
          ];
    })
    .sort((a, b) => a.start - b.start);

  const merged = [];
  busy.forEach((slot) => {
    const last = merged[merged.length - 1];
    if (!last || slot.start > last.end) merged.push({ ...slot });
    else last.end = Math.max(last.end, slot.end);
  });

  const free = [];
  let cursor = 0;
  merged.forEach((slot) => {
    if (slot.start > cursor) free.push({ start: cursor, end: slot.start });
    cursor = Math.max(cursor, slot.end);
  });
  if (cursor < 1440) free.push({ start: cursor, end: 1440 });
  return free;
}

function renderInsights() {
  const list = $("#insightList");
  list.replaceChildren();
  const planned = events.reduce((sum, event) => sum + durationOf(event), 0);
  const focus = events.filter((event) => event.type === "focus").reduce((sum, event) => sum + durationOf(event), 0);
  const rest = events.filter((event) => event.type === "rest").reduce((sum, event) => sum + durationOf(event), 0);
  const longestFree = getFreeSlots().sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const insights = [
    `집중 ${formatDuration(focus)} · 휴식 ${formatDuration(rest)}`,
    longestFree ? `가장 긴 빈 시간 ${minutesToLabel(longestFree.start)}-${minutesToLabel(longestFree.end)} (${formatDuration(longestFree.end - longestFree.start)})` : "빈 시간이 없습니다.",
  ];
  if (planned > 1080) insights.push("계획이 18시간을 넘었습니다. 완충 시간을 줄 수 있게 조정하세요.");
  if (detectConflicts().size > 0) insights.push("겹치는 일정이 있어 실제 실행 시간이 흔들릴 수 있습니다.");

  insights.forEach((text) => {
    const item = document.createElement("div");
    item.className = `insight-item ${text.includes("넘었습니다") || text.includes("겹치는") ? "warn" : ""}`;
    item.textContent = text;
    list.appendChild(item);
  });
}

function renderPersistenceStatus() {
  const savedAt = lastSave?.savedAt || state.updatedAt;
  const label = savedAt ? new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  $("#syncStatus").textContent = `로컬 저장 · ${label}`;
}

function renderAccountControls() {
  if (!$("#accountState")) return;
  const signedIn = Boolean(state.account?.email);
  $("#accountState").textContent = signedIn ? "로그인됨" : "오프라인";
  $("#accountEmailInput").value = state.account?.email || "";
  $("#signOutBtn").disabled = !signedIn;
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

function renderCustomTemplates() {
  const list = $("#customTemplateList");
  list.replaceChildren();
  state.templates.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${template.name} · ${template.events.length}개`;
    button.addEventListener("click", () => applyCustomTemplate(template.id));
    list.appendChild(button);
  });
}

function renderAll() {
  saveState();
  renderProfileControls();
  renderCustomTemplates();
  renderAccountControls();
  renderGithubControls();
  renderPersistenceStatus();
  renderInsights();
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

function applyCustomTemplate(id) {
  const template = state.templates.find((item) => item.id === id);
  if (!template) return;
  setEvents(cloneEvents(template.events));
  resetForm();
  renderAll();
}

function saveCurrentTemplate() {
  state.templates.push({
    id: crypto.randomUUID(),
    name: activeProfile().name,
    events: cloneEvents(events),
  });
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

async function startGithubLogin() {
  const clientId = $("#githubClientInput").value.trim();
  if (!clientId) {
    setGithubFeedback("OAuth Client ID를 먼저 입력하세요.", true);
    $("#githubClientInput").focus();
    return;
  }
  setGithubFeedback("GitHub 로그인으로 이동합니다.", false);
  const verifier = randomString();
  const stateValue = randomString(32);
  const challenge = base64Url(await sha256(verifier));
  sessionStorage.setItem(GITHUB_PKCE_KEY, JSON.stringify({ verifier, state: stateValue }));
  saveGithubConfig({
    ...getGithubConfig(),
    clientId,
    owner: $("#repoOwnerInput").value.trim(),
    repo: $("#repoNameInput").value.trim() || "rounday-data",
  });

  const redirectUri = `${location.origin}${location.pathname}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state: stateValue,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  location.href = `https://github.com/login/oauth/authorize?${params}`;
}

async function completeGithubLogin() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const stateValue = params.get("state");
  if (!code) return;

  const pkce = JSON.parse(sessionStorage.getItem(GITHUB_PKCE_KEY) || "null");
  const config = getGithubConfig();
  history.replaceState({}, document.title, `${location.origin}${location.pathname}${location.hash}`);
  if (!pkce || pkce.state !== stateValue || !config.clientId) {
    formError.textContent = "GitHub 로그인 상태를 확인할 수 없습니다.";
    return;
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.clientId,
        code,
        redirect_uri: `${location.origin}${location.pathname}`,
        code_verifier: pkce.verifier,
      }),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw new Error(token.error_description || "GitHub token 교환에 실패했습니다.");
    sessionStorage.setItem(GITHUB_TOKEN_KEY, token.access_token);
    sessionStorage.removeItem(GITHUB_PKCE_KEY);
    await hydrateGithubUser();
  } catch (error) {
    formError.textContent = error.message;
  }
}

async function hydrateGithubUser() {
  const config = getGithubConfig();
  if (!getGithubToken()) {
    renderGithubControls();
    return;
  }
  const user = await githubRequest("/user");
  saveGithubConfig({
    ...config,
    owner: config.owner || user.login,
    repo: config.repo || "rounday-data",
    login: user.login,
  });
  renderGithubControls();
}

function renderGithubControls() {
  const config = getGithubConfig();
  const connected = Boolean(getGithubToken());
  $("#githubClientInput").value = config.clientId || window.RoundayConfig?.githubClientId || "";
  $("#repoOwnerInput").value = config.owner || config.login || "";
  $("#repoNameInput").value = config.repo || "rounday-data";
  $("#githubState").textContent = connected ? config.login || "연결됨" : "미연결";
  setGithubFeedback(
    connected ? "연결되었습니다. 날짜를 선택해 저장하거나 불러올 수 있습니다." : "OAuth Client ID를 입력하면 GitHub 로그인을 시작할 수 있습니다.",
    false,
  );
  $("#githubLogoutBtn").disabled = !connected;
}

function setGithubFeedback(message, isError = false) {
  const target = $("#githubFeedback");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("danger-text", isError);
}

function persistGithubFormConfig() {
  saveGithubConfig({
    ...getGithubConfig(),
    clientId: $("#githubClientInput").value.trim(),
    owner: $("#repoOwnerInput").value.trim(),
    repo: $("#repoNameInput").value.trim() || "rounday-data",
  });
}

function schedulePath(date) {
  const [year, month] = date.split("-");
  return `data/schedules/${year}/${month}/${date}.json`;
}

function currentSchedulePayload(date) {
  return {
    date,
    profileId: activeProfile().id,
    profileName: activeProfile().name,
    events,
    templates: state.templates,
    updatedAt: new Date().toISOString(),
  };
}

async function createGithubDataRepo() {
  persistGithubFormConfig();
  const repo = $("#repoNameInput").value.trim() || "rounday-data";
  await githubRequest("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      private: true,
      description: "Rounday schedule data",
      has_issues: false,
      has_projects: false,
      has_wiki: false,
      auto_init: true,
    }),
  });
  $("#githubState").textContent = "repo 생성됨";
}

async function saveScheduleToGithub() {
  persistGithubFormConfig();
  const config = getGithubConfig();
  const date = $("#scheduleDateInput").value;
  const path = schedulePath(date);
  let sha;
  try {
    const existing = await githubRequest(`/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`);
    sha = existing.sha;
  } catch {
    sha = undefined;
  }
  await githubRequest(`/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Save Rounday schedule for ${date}`,
      content: base64Json(currentSchedulePayload(date)),
      sha,
    }),
  });
  $("#githubState").textContent = "저장됨";
}

async function loadScheduleFromGithub() {
  persistGithubFormConfig();
  const config = getGithubConfig();
  const date = $("#scheduleDateInput").value;
  const path = schedulePath(date);
  const file = await githubRequest(`/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`);
  const payload = parseBase64Json(file.content.replace(/\s/g, ""));
  setEvents((payload.events || []).map(normalizeEvent));
  if (Array.isArray(payload.templates)) state.templates = payload.templates.map((template) => ({
    id: typeof template.id === "string" ? template.id : crypto.randomUUID(),
    name: typeof template.name === "string" ? template.name : "가져온 템플릿",
    events: Array.isArray(template.events) ? template.events.map(normalizeEvent) : [],
  }));
  resetForm();
  renderAll();
  $("#githubState").textContent = "불러옴";
}

function logoutGithub() {
  sessionStorage.removeItem(GITHUB_TOKEN_KEY);
  renderGithubControls();
}

function signIn() {
  const email = $("#accountEmailInput").value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    formError.textContent = "계정 이메일을 확인하세요.";
    return;
  }
  state.account = { email, signedInAt: new Date().toISOString() };
  state.userId = `local:${email}`;
  formError.textContent = "";
  renderAll();
}

function signOut() {
  state.account = null;
  state.userId = null;
  renderAll();
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

async function copyShareLink() {
  const payload = encodeSharePayload(activeProfile());
  const url = `${location.origin}${location.pathname}#share=${encodeURIComponent(payload)}`;
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  } else {
    const input = document.createElement("textarea");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  $("#syncStatus").textContent = "공유 링크 복사됨";
}

function downloadClockSvg() {
  const clone = clockSvg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rounday-${activeProfile().name.replace(/\\s+/g, "-")}.svg`;
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

function renderInstallState() {
  $("#installAppBtn").classList.toggle("hidden", !deferredInstallPrompt);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => {
      registration.update();
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "SKIP_WAITING" });
        });
      });
    })
    .catch(() => {
      $("#syncStatus").textContent = "오프라인 캐시 등록 실패";
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("rounday-sw-refreshing")) return;
    sessionStorage.setItem("rounday-sw-refreshing", "1");
    location.reload();
  });
}

document.querySelectorAll("[data-template]").forEach((button) => {
  button.addEventListener("click", () => applyTemplate(button.dataset.template));
});

$("#downloadBtn").addEventListener("click", downloadJson);
$("#shareBtn").addEventListener("click", copyShareLink);
$("#imageExportBtn").addEventListener("click", downloadClockSvg);
$("#printBtn").addEventListener("click", () => window.print());
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
$("#saveTemplateBtn").addEventListener("click", saveCurrentTemplate);
$("#githubLoginBtn").addEventListener("click", () => startGithubLogin().catch((error) => setGithubFeedback(error.message, true)));
$("#githubLogoutBtn").addEventListener("click", logoutGithub);
$("#createRepoBtn").addEventListener("click", () => createGithubDataRepo().catch((error) => (formError.textContent = error.message)));
$("#saveGithubBtn").addEventListener("click", () => saveScheduleToGithub().catch((error) => (formError.textContent = error.message)));
$("#loadGithubBtn").addEventListener("click", () => loadScheduleFromGithub().catch((error) => (formError.textContent = error.message)));
$("#signInBtn")?.addEventListener("click", signIn);
$("#signOutBtn")?.addEventListener("click", signOut);
$("#installAppBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderInstallState();
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  renderInstallState();
});

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
$("#scheduleDateInput").value = new Date().toISOString().slice(0, 10);
renderGithubControls();
completeGithubLogin();
if (getGithubToken()) hydrateGithubUser().catch(() => logoutGithub());
registerServiceWorker();
renderAll();
setInterval(() => {
  renderClock();
  updateCurrentTime();
}, 60_000);
