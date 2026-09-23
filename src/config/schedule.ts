// Static class schedule — the single source of truth for the timetable.
// The schedule changes roughly twice a year: update this file and re-seed.
//
// Two views come from the same config:
// - Schedule display: subjects as-is, one line per slot (English is one line).
// - Homework lessons: split subjects (SPLIT_GROUPS) expand into one lesson per
//   group in the same slot, each with its own independent homework.

import type { DayKey, ScheduleSlot, StaticSchedule } from "@/types";

export const STATIC_SCHEDULE: StaticSchedule = {
  MONDAY: [
    { lessonNumber: 1, subject: "Математика" },
    { lessonNumber: 2, subject: "Физическая культура и здоровье" },
    { lessonNumber: 3, subject: "Физика" },
    { lessonNumber: 4, subject: "Биология" },
    { lessonNumber: 5, subject: "Обществоведение" },
    { lessonNumber: 6, subject: "Английский язык" },
  ],
  TUESDAY: [
    { lessonNumber: 1, subject: "Русская литература" },
    { lessonNumber: 2, subject: "Русский язык" },
    { lessonNumber: 3, subject: "География" },
    { lessonNumber: 4, subject: "Химия" },
    { lessonNumber: 5, subject: "История" },
    { lessonNumber: 6, subject: "Математика" },
    { lessonNumber: 7, subject: "Информатика" },
  ],
  WEDNESDAY: [{ lessonNumber: 1, subject: "Трудовое обучение (УПК)" }],
  THURSDAY: [
    { lessonNumber: 1, subject: "Английский язык" },
    { lessonNumber: 2, subject: "Математика" },
    { lessonNumber: 3, subject: "Белорусская литература" },
    { lessonNumber: 4, subject: "Белорусский язык" },
    { lessonNumber: 5, subject: "Химия" },
    { lessonNumber: 6, subject: "Физическая культура и здоровье" },
    { lessonNumber: 7, subject: "Астрономия" },
  ],
  FRIDAY: [
    { lessonNumber: 1, subject: "Биология" },
    { lessonNumber: 2, subject: "История" },
    { lessonNumber: 3, subject: "Белорусский язык" },
    { lessonNumber: 4, subject: "Физика" },
    { lessonNumber: 5, subject: "Русская литература" },
    { lessonNumber: 6, subject: "Математика" },
    { lessonNumber: 7, subject: "Физическая культура и здоровье" },
  ],
};

/** Subjects taught in parallel groups; each group becomes its own lesson. */
export const SPLIT_GROUPS: Record<string, string[]> = {
  "Английский язык": ["Веренич", "не Веренич"],
};

/** Lesson rows to store in the DB for a day: split subjects expand per group. */
export function lessonsForDay(day: DayKey): ScheduleSlot[] {
  const slots = STATIC_SCHEDULE[day as keyof typeof STATIC_SCHEDULE] ?? [];
  const rows: ScheduleSlot[] = [];
  for (const slot of slots) {
    const groups = SPLIT_GROUPS[slot.subject];
    if (!groups) {
      rows.push(slot);
      continue;
    }
    for (const group of groups) {
      rows.push({
        lessonNumber: slot.lessonNumber,
        subject: `${slot.subject} (${group})`,
      });
    }
  }
  return rows;
}

/** Standing joke homework attached to the Wednesday УПК lesson. */
export const UPK_HOMEWORK_TEXT = "ВАМ РЕАЛЬНО ЗАДАЮТ ДЗ ПО УПК???";
