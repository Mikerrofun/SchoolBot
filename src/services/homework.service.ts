import { prisma } from "@/lib/prisma";
import { compareHomework } from "@/lib/ai";
import type {
  DayHomeworkRow,
  HomeworkWithLesson,
  SaveHomeworkResult,
} from "@/types";

/**
 * Saves homework for a lesson. If homework already exists, AI decides
 * whether the incoming text is the same assignment (keep or replace with
 * a better wording) or a different one. A different assignment (same=false)
 * is saved as PENDING and needs admin approval; when AI is unavailable the
 * text is saved as APPROVED so the bot keeps working without AI.
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
        aiUsed: true,
        status: updated.status,
      };
    }
    return {
      id: existing.id,
      action: "kept",
      text: existing.text,
      aiUsed: true,
      status: existing.status,
    };
  }

  // same=false (different assignment) -> PENDING until an admin approves it.
  // AI unavailable -> save immediately so the bot keeps working without AI.
  const status = comparison ? "PENDING" : "APPROVED";
  const updated = await prisma.homework.update({
    where: { lessonId },
    data: { text: trimmed, createdBy, status },
  });
  return {
    id: updated.id,
    action: comparison ? "updated" : "duplicate_saved",
    text: updated.text,
    aiUsed: Boolean(comparison),
    status: updated.status,
  };
}

export async function getHomeworkByLesson(lessonId: number) {
  return prisma.homework.findUnique({ where: { lessonId } });
}

/**
 * All lessons of one date with their homework, ordered by lesson number.
 * PENDING homework is only revealed when the viewer is an admin.
 */
export async function getDayHomework(
  date: Date,
  opts: { includePending?: boolean } = {}
): Promise<DayHomeworkRow[]> {
  const lessons = await prisma.lesson.findMany({
    where: { date },
    include: { homework: { select: { text: true, status: true } } },
    orderBy: { lessonNumber: "asc" },
  });

  return lessons.map((lesson) => ({
    lesson,
    homework:
      lesson.homework &&
      (opts.includePending || lesson.homework.status === "APPROVED")
        ? lesson.homework
        : null,
  }));
}

/** Marks homework as APPROVED. Returns null when the record is gone. */
export async function approveHomework(
  id: number
): Promise<HomeworkWithLesson | null> {
  const existing = await prisma.homework.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.homework.update({
    where: { id },
    data: { status: "APPROVED" },
    include: { lesson: true },
  });
}

/** Deletes a PENDING record. Returns what was deleted, or null. */
export async function rejectHomework(
  id: number
): Promise<HomeworkWithLesson | null> {
  const existing = await prisma.homework.findUnique({
    where: { id },
    include: { lesson: true },
  });
  if (!existing) return null;
  await prisma.homework.delete({ where: { id } });
  return existing;
}
