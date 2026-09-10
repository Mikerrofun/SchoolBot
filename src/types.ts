// Single source of truth for shared domain types.
// Handlers, services and libs import types from here — no local duplicates.

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

export type HomeworkStatus = "PENDING" | "APPROVED";

export type Lesson = {
  id: number;
  date: Date;
  day: string;
  lessonNumber: number;
  subject: string;
};

export type HomeworkEntry = {
  id: number;
  lessonId: number;
  text: string;
  status: HomeworkStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdditionalEntry = {
  id: number;
  date: Date;
  text: string;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Lesson with its (possibly absent) homework text and moderation status. */
export type LessonWithHomework = Lesson & {
  homework: { text: string; status: HomeworkStatus } | null;
};

/** One row of the "whole day in one message" homework view. */
export type DayHomeworkRow = {
  lesson: Lesson;
  homework: { text: string; status: HomeworkStatus } | null;
};

/** Homework joined with its lesson — used for admin approve/reject flows. */
export type HomeworkWithLesson = HomeworkEntry & {
  lesson: Lesson;
};

/** All lessons of one weekday of a week window. */
export type WeekDayLessons = {
  date: Date;
  lessons: Lesson[];
};

export type SaveHomeworkResult = {
  id: number;
  action:
    | "created"
    | "updated"
    | "kept"
    | "duplicate_saved"
    /** AI unavailable — verdict unknown, saved as PENDING for manual review. */
    | "pending_ai_down";
  text: string;
  aiUsed: boolean;
  status: HomeworkStatus;
};

/** Why a homework submission was sent to admins for approval. */
export type AdminReviewReason = "same_false" | "ai_down";
