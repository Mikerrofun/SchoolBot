// Schedule-related domain types.

import type { DayKey } from "./common";

/** Week schedule template: subjects per weekday, in lesson order. */
export type ScheduleTemplate = Record<
  Exclude<DayKey, "SATURDAY" | "SUNDAY">,
  string[]
>;

export type Lesson = {
  id: number;
  date: Date;
  day: string;
  lessonNumber: number;
  subject: string;
};

/** All lessons of one weekday of a week window. */
export type WeekDayLessons = {
  date: Date;
  lessons: Lesson[];
};
