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

/** One static schedule slot: the real lesson number plus the subject. */
export type ScheduleSlot = {
  lessonNumber: number;
  subject: string;
};

/** Static week schedule: real lesson numbers per weekday. */
export type StaticSchedule = Record<
  Exclude<DayKey, "SATURDAY" | "SUNDAY">,
  ScheduleSlot[]
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
