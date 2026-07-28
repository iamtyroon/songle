/**
 * Self-check for the streak rules. No framework — run it directly:
 *   node src/lib/streak.test.ts
 */
import assert from "node:assert/strict";
import { advanceStreak, effectiveStreak, dayKey, previousDayKey } from "./streak.ts";

const today = new Date("2026-07-28T12:00:00");
const yesterday = previousDayKey(today);
const todayStr = dayKey(today);
const longAgo = "2026-07-20";

// --- advanceStreak -----------------------------------------------------------

assert.equal(advanceStreak(0, undefined, true, today), 1, "first ever win starts at 1");
assert.equal(advanceStreak(0, undefined, false, today), 0, "first ever loss stays at 0");

assert.equal(advanceStreak(4, yesterday, true, today), 5, "win the day after a win extends");
assert.equal(advanceStreak(4, yesterday, false, today), 0, "a loss always resets");

assert.equal(advanceStreak(9, longAgo, true, today), 1, "a skipped day restarts the run at 1");
assert.equal(advanceStreak(9, longAgo, false, today), 0, "a loss after a gap is still 0");

assert.equal(advanceStreak(3, todayStr, true, today), 3, "replaying today does not inflate");
assert.equal(advanceStreak(0, todayStr, true, today), 1, "same-day replay floors at 1");

// --- effectiveStreak ---------------------------------------------------------

assert.equal(effectiveStreak(5, todayStr, today), 5, "played today: streak shows");
assert.equal(effectiveStreak(5, yesterday, today), 5, "played yesterday: still alive today");
assert.equal(effectiveStreak(5, longAgo, today), 0, "skipped a day: decays to 0 on read");
assert.equal(effectiveStreak(0, todayStr, today), 0, "lost today: nothing to show");
assert.equal(effectiveStreak(5, undefined, today), 0, "no play date recorded: cannot be alive");
assert.equal(effectiveStreak(undefined, todayStr, today), 0, "no streak recorded");

// --- the sequence from the spec ---------------------------------------------
// Mon win -> 1, Tue win -> 2, Wed miss, Thu win -> 1, Fri loss -> 0
{
  const mon = new Date("2026-07-27T12:00:00");
  const tue = new Date("2026-07-28T12:00:00");
  const thu = new Date("2026-07-30T12:00:00");
  const fri = new Date("2026-07-31T12:00:00");

  let streak = advanceStreak(0, undefined, true, mon);
  assert.equal(streak, 1, "Mon win");

  streak = advanceStreak(streak, dayKey(mon), true, tue);
  assert.equal(streak, 2, "Tue win");

  // Wednesday is skipped entirely — nothing is written that day.
  assert.equal(effectiveStreak(streak, dayKey(tue), thu), 0, "Thu read: Wed gap killed it");

  streak = advanceStreak(streak, dayKey(tue), true, thu);
  assert.equal(streak, 1, "Thu win restarts at 1");

  streak = advanceStreak(streak, dayKey(thu), false, fri);
  assert.equal(streak, 0, "Fri loss");
}

console.log("streak: all assertions passed");
