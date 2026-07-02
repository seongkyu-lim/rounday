import assert from "node:assert/strict";
import test from "node:test";

function repeatEventsForDate(dailyPlans, date) {
  const dates = Object.keys(dailyPlans || {}).filter((existing) => existing !== date).sort();
  if (!dates.length) return [];
  const pastDates = dates.filter((existing) => existing < date);
  const referenceDate = pastDates.length ? pastDates[pastDates.length - 1] : dates[dates.length - 1];
  return dailyPlans[referenceDate].events.filter((event) => event.repeat);
}

const plans = {
  "2026-07-01": {
    events: [
      { title: "수면", repeat: true },
      { title: "회의", repeat: false },
    ],
  },
  "2026-07-03": {
    events: [
      { title: "수면", repeat: true },
      { title: "운동", repeat: true },
      { title: "약속", repeat: false },
    ],
  },
};

test("repeatEventsForDate picks the nearest past date", () => {
  const repeated = repeatEventsForDate(plans, "2026-07-02");
  assert.deepEqual(repeated.map((event) => event.title), ["수면"]);
});

test("repeatEventsForDate falls back to the latest date when no past date exists", () => {
  const repeated = repeatEventsForDate(plans, "2026-06-30");
  assert.deepEqual(repeated.map((event) => event.title), ["수면", "운동"]);
});

test("repeatEventsForDate only returns events marked repeat", () => {
  const repeated = repeatEventsForDate(plans, "2026-07-04");
  assert.ok(repeated.every((event) => event.repeat));
});

test("repeatEventsForDate returns empty for empty plans", () => {
  assert.deepEqual(repeatEventsForDate({}, "2026-07-02"), []);
});

test("repeatEventsForDate ignores the target date itself", () => {
  const repeated = repeatEventsForDate(plans, "2026-07-03");
  assert.deepEqual(repeated.map((event) => event.title), ["수면"]);
});
