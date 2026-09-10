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
 * is saved as PENDING and needs admin approval. When AI is unavailable the
 * verdict is unknown, so the submission is also saved as PENDING — an
 * unverified text is never auto-approved; admins get an "AI down" notice.
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
  // AI unavailable -> the verdict is unknown, so also PENDING: an unverified
  // text must never replace the approved one automatically. Admins get
  // notified in both cases, with a different reason mark.
  const updated = await prisma.homework.update({
    where: { lessonId },
    data: { text: trimmed, createdBy, status: "PENDING" },
  });
  return {
    id: updated.id,
    action: comparison ? "updated" : "pending_ai_down",
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
