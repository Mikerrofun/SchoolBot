// Barrel for all shared domain types.
// Handlers, services and libs import types from here — no local duplicates.

export type {
  DayKey,
  WeekOffset,
  WeekWindow,
} from "./common";

export type {
  Lesson,
  ScheduleTemplate,
  WeekDayLessons,
} from "./schedule";

export type {
  AdditionalEntry,
  AdminReviewReason,
  DayHomework,
  DayHomeworkRow,
  HomeworkCreatedResult,
  HomeworkEntry,
  HomeworkExistingResult,
  HomeworkStatus,
  HomeworkView,
  HomeworkWithLesson,
  LessonWithHomework,
  NewHomeworkNotification,
  SaveHomeworkResult,
} from "./homework";

export type {
  Flow,
  MyContext,
  NavState,
  PendingInput,
  SessionData,
} from "./bot";

export type { BotErrorCode, ErrorInfo } from "./errors";

export type { UserRecord } from "./user";
