import { prisma } from "@/lib/prisma";
import { SCHEDULE_TEMPLATE, UPK_HOMEWORK_TEXT } from "@/lib/schedule-template";
import { addDays, dateKey, dayKeyFromDate, startOfWeek, weekDates } from "@/lib/weeks";
import type {
  DayKey,
  Lesson,
  LessonWithHomework,
  WeekDayLessons,
  WeekWindow,
} from "@/types";

/**
 * Lazy creation: if the requested week has no lessons yet, create them from
 * SCHEDULE_TEMPLATE. Idempotent — safe to call on every request. The УПК
 * lesson on Wednesday also gets its standing joke homework.
 */
async function ensureWeekScheduleExists(window: WeekWindow): Promise<void> {
  const monday = startOfWeek(window.start);
  const dates = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  const existing = await prisma.lesson.findMany({
    where: { date: { gte: dates[0], lte: dates[4] } },
    select: { date: true },
    distinct: ["date"],
  });
  const existingDates = new Set(existing.map((l) => dateKey(l.date)));

  let upkLessonId: number | null = null;

  for (const date of dates) {
    if (existingDates.has(dateKey(date))) continue;

    const day = dayKeyFromDate(date);
    const subjects = SCHEDULE_TEMPLATE[day as keyof typeof SCHEDULE_TEMPLATE];
    for (let n = 0; n < subjects.length; n++) {
      const lesson = await prisma.lesson.upsert({
        where: {
          date_lessonNumber_subject: { date, lessonNumber: n + 1, subject: subjects[n] },
        },
        update: {},
        create: { date, day, lessonNumber: n + 1, subject: subjects[n] },
      });
      if (subjects[n].includes("УПК")) upkLessonId = lesson.id;
    }
  }

  if (upkLessonId !== null) {
    await prisma.homework.upsert({
      where: { lessonId: upkLessonId },
      update: {},
      create: {
        lessonId: upkLessonId,
        text: UPK_HOMEWORK_TEXT,
        status: "APPROVED",
        createdBy: "system",
      },
    });
  }
}

/** All lessons (with homework) between two dates, ordered by day and lesson number. */
export async function getLessonsInRange(
  from: Date,
  to: Date
): Promise<LessonWithHomework[]> {
  await ensureWeekScheduleExists({ start: from, end: to, offset: 0 });

  return prisma.lesson.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      homework: { select: { text: true, pendingText: true, status: true } },
    },
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
    include: {
      homework: { select: { text: true, pendingText: true, status: true } },
    },
  });
}
