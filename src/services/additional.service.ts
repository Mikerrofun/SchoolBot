import { prisma } from "@/lib/prisma";
import { dateKey, weekDates } from "@/lib/weeks";
import type { WeekWindow } from "@/types";

/**
 * "Additional" section for a week window: one row per weekday (Mon–Fri),
 * `text` is null when nothing was saved for that day yet.
 */
export async function getAdditionalForWeek(
  window: WeekWindow
): Promise<{ date: Date; text: string | null }[]> {
  const entries = await prisma.additionalHomework.findMany({
    where: { date: { gte: window.start, lte: window.end } },
  });
  const byDate = new Map(entries.map((e) => [dateKey(e.date), e.text]));
  return weekDates(window.offset).map((date) => ({
    date,
    text: byDate.get(dateKey(date)) ?? null,
  }));
}

/** Saves (or replaces) the "Additional" entry for a concrete date. */
export async function upsertAdditional(
  date: Date,
  text: string,
  authorId?: string
) {
  return prisma.additionalHomework.upsert({
    where: { date },
    update: { text, authorId },
    create: { date, text, authorId },
  });
}
