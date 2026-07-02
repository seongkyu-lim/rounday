import assert from "node:assert/strict";
import test from "node:test";

function recordedPlanDates(dailyPlans) {
  return Object.keys(dailyPlans || {})
    .filter((date) => dailyPlans[date].events.length > 0)
    .sort()
    .reverse();
}

test("recordedPlanDates returns dates with events in recent-first order", () => {
  const dates = recordedPlanDates({
    "2026-07-01": { events: [{ title: "수면" }] },
    "2026-07-03": { events: [{ title: "운동" }] },
    "2026-06-28": { events: [{ title: "약속" }] },
  });
  assert.deepEqual(dates, ["2026-07-03", "2026-07-01", "2026-06-28"]);
});

test("recordedPlanDates skips dates without events", () => {
  const dates = recordedPlanDates({
    "2026-07-01": { events: [] },
    "2026-07-02": { events: [{ title: "수면" }] },
  });
  assert.deepEqual(dates, ["2026-07-02"]);
});

test("recordedPlanDates handles missing plans", () => {
  assert.deepEqual(recordedPlanDates(undefined), []);
  assert.deepEqual(recordedPlanDates({}), []);
});
