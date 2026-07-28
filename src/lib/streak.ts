/**
 * Daily streak rules.
 *
 * A streak counts consecutive days on which the player finished the daily song
 * with a win. It breaks on a loss and on a skipped day.
 *
 * Days are the player's own local calendar days, so the streak rolls over at
 * their midnight rather than UTC's.
 */

/** Local calendar day, e.g. "2026-07-28". en-CA formats as ISO. */
export function dayKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}

export function previousDayKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/**
 * The streak to store after today's game ends.
 *
 * `lastPlayedDate` is the day of the player's previous completed game, which is
 * what tells a genuine gap apart from an unbroken run.
 */
export function advanceStreak(
  storedStreak: number,
  lastPlayedDate: string | undefined,
  hasWon: boolean,
  today: Date = new Date()
): number {
  if (!hasWon) return 0;

  // Replaying an already-finished day must not inflate the count.
  if (lastPlayedDate === dayKey(today)) return Math.max(storedStreak, 1);

  if (lastPlayedDate === previousDayKey(today)) return storedStreak + 1;

  // First game ever, or the run was already broken by a skipped day.
  return 1;
}

/**
 * The streak to display right now.
 *
 * A stored streak dies the moment a day is skipped, but nothing writes to the
 * record on a day the player never shows up — so the stored number stays stale
 * until their next game. Decay it at read time instead of trusting it.
 */
export function effectiveStreak(
  storedStreak: number | undefined,
  lastPlayedDate: string | undefined,
  today: Date = new Date()
): number {
  if (!storedStreak || !lastPlayedDate) return 0;

  const alive =
    lastPlayedDate === dayKey(today) || lastPlayedDate === previousDayKey(today);

  return alive ? storedStreak : 0;
}
