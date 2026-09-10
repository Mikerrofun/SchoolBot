import { prisma } from "@/lib/prisma";
import { dateKey, dayKeyFromDate, weekDates } from "@/lib/weeks";
import type {
  DayKey,
  Lesson,
  LessonWithHomework,
  WeekDayLessons,
  WeekWindow,
} from "@/types";

/** All lessons (with homework) between two dates, ordered by day and lesson number. */
export async function getLessonsInRange(
  from: Date,
  to: Date
): Promise<LessonWithHomework[]> {
  return prisma.lesson.findMany({
    where: { date: { gte: from, lte: to } },
    include: { homework: { select: { text: true, status: true } } },
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

/** All five weekdays of a week window with their lessons (possibly empty). */
export async function getWeekLessons(
  window: WeekWindow
): Promise<WeekDayLessons[]> {
  const lessons = await getLessonsInRange(window.start, window.end);
  const byDate = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    const key = dateKey(lesson.date);
    const list = byDate.get(key) ?? [];
    list.push(lesson);
    byDate.set(key, list);
  }
  return weekDates(window.offset).map((date) => ({
    date,
    lessons: byDate.get(dateKey(date)) ?? [],
  }));
}

export async function getLessonById(id: number): Promise<Lesson | null> {
  return prisma.lesson.findUnique({ where: { id } });
}

export async function getLessonWithHomework(
  id: number
): Promise<LessonWithHomework | null> {
  return prisma.lesson.findUnique({
    where: { id },
    include: { homework: { select: { text: true, status: true } } },
  });
}
