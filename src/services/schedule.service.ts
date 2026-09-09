import { prisma } from "@/lib/prisma";
import { dayKeyFromDate, type DayKey } from "@/lib/weeks";

export type LessonWithHomework = {
  id: number;
  date: Date;
  day: string;
  lessonNumber: number;
  subject: string;
  homework: { text: string } | null;
};

/** All lessons (with homework) between two dates, ordered by day and lesson number. */
export async function getLessonsInRange(
  from: Date,
  to: Date
): Promise<LessonWithHomework[]> {
  const toEnd = new Date(to);
  toEnd.setUTCHours(23, 59, 59, 999);

  return prisma.lesson.findMany({
    where: { date: { gte: from, lte: toEnd } },
    include: { homework: { select: { text: true } } },
    orderBy: [{ date: "asc" }, { lessonNumber: "asc" }],
  });
}

/** Group lessons by day key, preserving day order Monday..Sunday. */
export function groupByDay(
  lessons: LessonWithHomework[]
): Map<DayKey, LessonWithHomework[]> {
  const map = new Map<DayKey, LessonWithHomework[]>();
  for (const lesson of lessons) {
    const key = dayKeyFromDate(lesson.date);
    const list = map.get(key) ?? [];
    list.push(lesson);
    map.set(key, list);
  }
  return map;
}
