import { prisma } from "@/lib/prisma";
import { compareHomework } from "@/lib/ai";
import type {
  DayHomework,
  HomeworkWithLesson,
  SaveHomeworkResult,
} from "@/types";

/**
 * Saves homework for a lesson. If homework already exists, AI decides
 * whether the incoming text is the same assignment (keep, or replace with
 * a better wording) or a different one. A different assignment (same=false)
 * never touches the approved `text`: it is stored in `pendingText` and stays
 * there until an admin approves it (then it replaces `text`) or rejects it
 * (then it is cleared and `text` remains). When AI is unavailable the verdict
 * is unknown, so the submission goes through the same pending flow — admins
 * get an "AI down" notice instead of the usual one.
 */
export async function saveHomework(params: {
  lessonId: number;
  text: string;
  createdBy?: string;
}): Promise<SaveHomeworkResult> {
  const { lessonId, text, createdBy } = params;
  const trimmed = text.trim();

  const existing = await prisma.homework.findUnique({ where: { lessonId } });

  if (!existing) {
    const created = await prisma.homework.create({
      data: { lessonId, text: trimmed, createdBy },
    });
    return {
      id: created.id,
      action: "created",
      text: created.text,
      oldText: null,
      aiUsed: false,
      status: created.status,
    };
  }

  const comparison = await compareHomework(existing.text, trimmed);

  if (comparison?.same) {
    if (comparison.betterText && comparison.betterText !== existing.text) {
      const updated = await prisma.homework.update({
        where: { lessonId },
        data: { text: comparison.betterText, createdBy, status: "APPROVED" },
      });
      return {
        id: updated.id,
        action: "updated",
        text: updated.text,
        oldText: existing.text,
        aiUsed: true,
        status: updated.status,
      };
    }
    return {
      id: existing.id,
      action: "kept",
      text: existing.text,
      oldText: existing.text,
      aiUsed: true,
      status: existing.status,
    };
  }

  // same=false (different assignment) or AI unavailable -> the submission
  // waits in `pendingText` for admin review; the approved `text` stays
  // visible to students in the meantime. A repeated submission while still
  // pending simply overwrites `pendingText` (last version wins).
  const updated = await prisma.homework.update({
    where: { lessonId },
    data: {
      pendingText: trimmed,
      pendingCreatedBy: createdBy,
      status: "PENDING",
    },
  });
  return {
    id: updated.id,
    action: comparison ? "updated" : "pending_ai_down",
    text: trimmed,
    oldText: existing.text,
    aiUsed: Boolean(comparison),
    status: updated.status,
  };
}

export async function getHomeworkByLesson(lessonId: number) {
  return prisma.homework.findUnique({ where: { lessonId } });
}

/**
 * All lessons of one date with their homework, ordered by lesson number,
 * plus the day's "Additional" text. PENDING homework is only revealed when
 * the viewer is an admin; the approved `text` is always shown.
 */
export async function getDayHomework(
  date: Date,
  opts: { includePending?: boolean } = {}
): Promise<DayHomework> {
  const [lessons, additional] = await Promise.all([
    prisma.lesson.findMany({
      where: { date },
      include: {
        homework: { select: { text: true, pendingText: true, status: true } },
      },
      orderBy: { lessonNumber: "asc" },
    }),
    prisma.additionalHomework.findUnique({ where: { date } }),
  ]);

  return {
    rows: lessons.map((lesson) => ({
      lesson,
      homework:
        lesson.homework &&
        (opts.includePending || lesson.homework.status === "APPROVED")
          ? lesson.homework
          : null,
    })),
    additional: additional?.text ?? null,
  };
}

/**
 * Promotes the pending text to the approved one. Returns null when the
 * record is gone. Without a pending text this is a no-op that just
 * re-approves the current `text`.
 */
export async function approveHomework(
  id: number
): Promise<HomeworkWithLesson | null> {
  const existing = await prisma.homework.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.homework.update({
    where: { id },
    data: {
      text: existing.pendingText ?? existing.text,
      createdBy: existing.pendingCreatedBy ?? existing.createdBy,
      pendingText: null,
      pendingCreatedBy: null,
      status: "APPROVED",
    },
    include: { lesson: true },
  });
}

/**
 * Clears the pending text and keeps the previously approved `text` as is.
 * Returns the record (with the text that stayed), or null when it is gone.
 */
export async function rejectHomework(
  id: number
): Promise<HomeworkWithLesson | null> {
  const existing = await prisma.homework.findUnique({
    where: { id },
    include: { lesson: true },
  });
  if (!existing) return null;
  return prisma.homework.update({
    where: { id },
    data: {
      pendingText: null,
      pendingCreatedBy: null,
      status: "APPROVED",
    },
    include: { lesson: true },
  });
}
