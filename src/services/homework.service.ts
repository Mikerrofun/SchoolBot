import { prisma } from "@/lib/prisma";
import { compareHomework } from "@/lib/ai";

export type SaveHomeworkResult = {
  action: "created" | "updated" | "kept" | "duplicate_saved";
  text: string;
  aiUsed: boolean;
};

/**
 * Saves homework for a lesson. If homework already exists, AI decides
 * whether the incoming text is the same assignment (keep or replace with
 * a better wording) or a different one (save as new). If AI is unavailable,
 * the incoming text is saved anyway so the bot keeps working.
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
    return { action: "created", text: created.text, aiUsed: false };
  }

  const comparison = await compareHomework(existing.text, trimmed);

  if (comparison?.same) {
    if (comparison.betterText && comparison.betterText !== existing.text) {
      const updated = await prisma.homework.update({
        where: { lessonId },
        data: { text: comparison.betterText, createdBy },
      });
      return { action: "updated", text: updated.text, aiUsed: true };
    }
    return { action: "kept", text: existing.text, aiUsed: true };
  }

  // Different assignment (or AI unavailable) — replace with the new text
  // so the lesson always shows the freshest homework.
  const updated = await prisma.homework.update({
    where: { lessonId },
    data: { text: trimmed, createdBy },
  });
  return {
    action: comparison ? "updated" : "duplicate_saved",
    text: updated.text,
    aiUsed: Boolean(comparison),
  };
}

export async function getHomeworkByLesson(lessonId: number) {
  return prisma.homework.findUnique({ where: { lessonId } });
}
