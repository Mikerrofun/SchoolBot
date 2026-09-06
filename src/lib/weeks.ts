// Week utilities: the bot always works with three weeks
// (previous / current / next) computed from concrete dates.

export type WeekOffset = -1 | 0 | 1;

export const DAY_KEYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  MONDAY: "Понедельник",
  TUESDAY: "Вторник",
  WEDNESDAY: "Среда",
  THURSDAY: "Четверг",
  FRIDAY: "Пятница",
  SATURDAY: "Суббота",
  SUNDAY: "Воскресенье",
};

export const WEEK_LABELS: Record<WeekOffset, string> = {
  [-1]: "Прошлая неделя",
  0: "Текущая неделя",
  1: "Следующая неделя",
};

/** Returns the Monday of the week containing `date` (UTC, time zeroed). */
export function startOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Monday of the current week. */
export function currentWeekStart(now: Date = new Date()): Date {
  return startOfWeek(now);
}

/** Monday of the week shifted by `offset` weeks. */
export function weekStart(offset: WeekOffset, now: Date = new Date()): Date {
  return addDays(currentWeekStart(now), offset * 7);
}

/** [monday, sunday] of the week shifted by `offset` weeks. */
export function weekRange(
  offset: WeekOffset,
  now: Date = new Date()
): [Date, Date] {
  const start = weekStart(offset, now);
  return [start, addDays(start, 6)];
}

/** Monday..Sunday dates of the week shifted by `offset` weeks. */
export function weekDates(offset: WeekOffset, now: Date = new Date()): Date[] {
  const start = weekStart(offset, now);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Date-only key in UTC, e.g. "2026-09-07". */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Human-readable date, e.g. "07.09.2026". */
export function formatDate(date: Date): string {
  return dateKey(date)
    .split("-")
    .reverse()
    .join(".");
}

export function dayKeyFromDate(date: Date): DayKey {
  return DAY_KEYS[(date.getUTCDay() + 6) % 7];
}

/** Parses "2026-09-07" into a UTC date at midnight. */
export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
