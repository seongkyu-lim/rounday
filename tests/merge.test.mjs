import assert from "node:assert/strict";
import test from "node:test";

function mergeDailyPlanMaps(stored, current) {
  const dates = new Set([...Object.keys(stored || {}), ...Object.keys(current || {})]);
  const merged = {};
  dates.forEach((date) => {
    const storedPlan = stored?.[date];
    const currentPlan = current?.[date];
    if (!storedPlan || !currentPlan) {
      merged[date] = currentPlan || storedPlan;
      return;
    }
    const storedTime = Date.parse(storedPlan.updatedAt || "") || 0;
    const currentTime = Date.parse(currentPlan.updatedAt || "") || 0;
    merged[date] = storedTime > currentTime ? storedPlan : currentPlan;
  });
  return merged;
}

test("mergeDailyPlanMaps keeps dates the current tab does not know", () => {
  const merged = mergeDailyPlanMaps(
    { "2026-07-03": { events: [{ title: "약속" }], updatedAt: "2026-07-02T10:00:00Z" } },
    { "2026-07-02": { events: [{ title: "수면" }], updatedAt: "2026-07-02T11:00:00Z" } },
  );
  assert.deepEqual(Object.keys(merged).sort(), ["2026-07-02", "2026-07-03"]);
});

test("mergeDailyPlanMaps prefers the newer plan for the same date", () => {
  const merged = mergeDailyPlanMaps(
    { "2026-07-02": { events: [{ title: "옛것" }], updatedAt: "2026-07-02T09:00:00Z" } },
    { "2026-07-02": { events: [{ title: "새것" }], updatedAt: "2026-07-02T11:00:00Z" } },
  );
  assert.equal(merged["2026-07-02"].events[0].title, "새것");

  const storedNewer = mergeDailyPlanMaps(
    { "2026-07-02": { events: [{ title: "옛것" }], updatedAt: "2026-07-02T12:00:00Z" } },
    { "2026-07-02": { events: [{ title: "새것" }], updatedAt: "2026-07-02T11:00:00Z" } },
  );
  assert.equal(storedNewer["2026-07-02"].events[0].title, "옛것");
});

test("mergeDailyPlanMaps prefers current on ties or missing timestamps", () => {
  const merged = mergeDailyPlanMaps(
    { "2026-07-02": { events: [{ title: "스토리지" }] } },
    { "2026-07-02": { events: [{ title: "메모리" }] } },
  );
  assert.equal(merged["2026-07-02"].events[0].title, "메모리");
});

test("mergeDailyPlanMaps handles empty inputs", () => {
  assert.deepEqual(mergeDailyPlanMaps(undefined, {}), {});
  const onlyStored = mergeDailyPlanMaps({ "2026-07-01": { events: [] } }, undefined);
  assert.deepEqual(Object.keys(onlyStored), ["2026-07-01"]);
});
