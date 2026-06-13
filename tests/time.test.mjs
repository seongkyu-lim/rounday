import assert from "node:assert/strict";
import test from "node:test";

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function durationOf(event) {
  const start = timeToMinutes(event.start);
  const end = timeToMinutes(event.end);
  return end > start ? end - start : 1440 - start + end;
}

function getFreeSlots(events) {
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

test("durationOf handles same-day events", () => {
  assert.equal(durationOf({ start: "09:00", end: "10:30" }), 90);
});

test("durationOf handles events crossing midnight", () => {
  assert.equal(durationOf({ start: "23:30", end: "01:00" }), 90);
});

test("getFreeSlots merges overlapping busy ranges", () => {
  assert.deepEqual(getFreeSlots([
    { start: "09:00", end: "11:00" },
    { start: "10:30", end: "12:00" },
    { start: "13:00", end: "14:00" },
  ]), [
    { start: 0, end: 540 },
    { start: 720, end: 780 },
    { start: 840, end: 1440 },
  ]);
});

test("getFreeSlots splits midnight-crossing busy ranges", () => {
  assert.deepEqual(getFreeSlots([{ start: "22:00", end: "02:00" }]), [{ start: 120, end: 1320 }]);
});
