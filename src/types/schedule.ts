// Schedule domain types: weeks, days, lessons.

export type WeekOffset = -1 | 0 | 1;

export type DayKey =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** The -1/0/1 week window, always computed on the fly from concrete dates. */
export type WeekWindow = {
  /** Monday 00:00:00.000 of the week. */
  start: Date;
  /** Sunday 23:59:59.999 of the week. */
  end: Date;
  offset: WeekOffset;
};

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
