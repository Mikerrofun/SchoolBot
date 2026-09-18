import { prisma } from "@/lib/prisma";
import { dateKey, weekDates } from "@/lib/weeks";
import type { AdditionalEntry, AdditionalWeekRow, WeekWindow } from "@/types";

/**
 * "Additional" section for a week window: one row per weekday (Mon–Fri),
 * `text` is null when nothing was saved for that day yet.
 */
export async function getAdditionalForWeek(
  window: WeekWindow
): Promise<AdditionalWeekRow[]> {
  const entries = await prisma.additionalHomework.findMany({
    where: { date: { gte: window.start, lte: window.end } },
  });
  const byDate = new Map(entries.map((e) => [dateKey(e.date), e.text]));
  return weekDates(window.offset).map((date) => ({
    date,
    // An empty approved text (a rejected first-time pending entry) reads
    // as "nothing saved" for students.
    text: byDate.get(dateKey(date)) || null,
  }));
}

/**
 * Saves (or replaces) the "Additional" entry for a concrete date. When the
 * censorship AI was down (`aiDown`) the submission is not approved
 * automatically: it waits in `pendingText` for admin review, while the
 * previously approved text stays visible. A first-time entry stores an
 * empty approved text so students see nothing until an admin approves.
 */
export async function upsertAdditional(
  date: Date,
  text: string,
  authorId?: string,
  opts: { aiDown?: boolean } = {}
) {
  const trimmed = text.trim();

  if (opts.aiDown) {
    return prisma.additionalHomework.upsert({
      where: { date },
      update: {
        pendingText: trimmed,
        pendingAuthorId: authorId,
        status: "PENDING",
      },
      create: {
        date,
        text: "",
        pendingText: trimmed,
        pendingAuthorId: authorId,
        status: "PENDING",
      },
    });
  }

  // The new text passed censorship, so it replaces the approved one and
  // clears whatever was waiting for review.
  return prisma.additionalHomework.upsert({
    where: { date },
    update: {
      text: trimmed,
      authorId,
      pendingText: null,
      pendingAuthorId: null,
      status: "APPROVED",
    },
    create: { date, text: trimmed, authorId },
  });
}

/**
 * Promotes the pending text to the approved one. Returns null when the
 * record is gone. Without a pending text this is a no-op that just
 * re-approves the current `text`.
 */
export async function approveAdditional(
  id: number
): Promise<AdditionalEntry | null> {
  const existing = await prisma.additionalHomework.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.additionalHomework.update({
    where: { id },
    data: {
      text: existing.pendingText ?? existing.text,
      authorId: existing.pendingAuthorId ?? existing.authorId,
      pendingText: null,
      pendingAuthorId: null,
      status: "APPROVED",
    },
  });
}

/**
 * Clears the pending text and keeps the previously approved `text` as is.
 * Returns the record (with the text that stayed), or null when it is gone.
 */
export async function rejectAdditional(
  id: number
): Promise<AdditionalEntry | null> {
  const existing = await prisma.additionalHomework.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.additionalHomework.update({
    where: { id },
    data: {
      pendingText: null,
      pendingAuthorId: null,
      status: "APPROVED",
    },
  });
}
