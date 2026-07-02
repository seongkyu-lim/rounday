import assert from "node:assert/strict";
import test from "node:test";

function nearestPreviousPlanDate(dailyPlans, date) {
  const dates = Object.keys(dailyPlans || {})
    .filter((existing) => existing < date && dailyPlans[existing].events.length > 0)
    .sort();
  return dates[dates.length - 1] || "";
}

const plans = {
  "2026-06-28": { events: [{ title: "수면" }] },
  "2026-07-01": { events: [{ title: "수면" }, { title: "운동" }] },
  "2026-07-02": { events: [] },
  "2026-07-05": { events: [{ title: "약속" }] },
};

test("nearestPreviousPlanDate picks the closest earlier date", () => {
  assert.equal(nearestPreviousPlanDate(plans, "2026-07-04"), "2026-07-01");
});

test("nearestPreviousPlanDate skips dates with no events", () => {
  assert.equal(nearestPreviousPlanDate(plans, "2026-07-03"), "2026-07-01");
});

test("nearestPreviousPlanDate ignores the same and future dates", () => {
  assert.equal(nearestPreviousPlanDate(plans, "2026-07-01"), "2026-06-28");
});

test("nearestPreviousPlanDate returns empty when nothing is earlier", () => {
  assert.equal(nearestPreviousPlanDate(plans, "2026-06-28"), "");
  assert.equal(nearestPreviousPlanDate({}, "2026-07-01"), "");
});
