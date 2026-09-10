// Week utilities: the bot always works with three weeks
// (previous / current / next) computed from concrete dates.
// The school timezone only decides which calendar day is "today";
// dates are stored and queried as UTC-midnight calendar dates.

import type { DayKey, WeekOffset, WeekWindow } from "@/types";

/** School timezone; decides when the current week rolls over. */
export const SCHOOL_TIMEZONE = process.env.SCHOOL_TIMEZONE ?? "Europe/Moscow";

export const DAY_KEYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const satisfies readonly DayKey[];

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

/** School week is five days, Monday through Friday. */
export const SCHOOL_WEEK_DAYS = 5;

/** Calendar date (UTC midnight) of "today" in the school timezone. */
export function todayInSchoolTimezone(now: Date = new Date()): Date {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = formatted.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

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

export function currentWeekStart(now: Date = new Date()): Date {
  return startOfWeek(todayInSchoolTimezone(now));
}

export function weekStart(offset: WeekOffset, now: Date = new Date()): Date {
  return addDays(currentWeekStart(now), offset * 7);
}

/**
 * The single source of week boundaries: Monday 00:00 through
 * Sunday 23:59:59.999 of the week shifted by `offset`.
 */
export function getWeekWindow(
  offset: WeekOffset,
  now: Date = new Date()
): WeekWindow {
  const start = weekStart(offset, now);
  const end = addDays(start, 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end, offset };
}

/** Mon–Fri dates of the week (Saturday/Sunday are not shown). */
export function weekDates(offset: WeekOffset, now: Date = new Date()): Date[] {
  const start = weekStart(offset, now);
  return Array.from({ length: SCHOOL_WEEK_DAYS }, (_, i) => addDays(start, i));
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date): string {
  return dateKey(date)
    .split("-")
    .reverse()
    .join(".");
}

export function dayKeyFromDate(date: Date): DayKey {
  return DAY_KEYS[(date.getUTCDay() + 6) % 7];
}

export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
