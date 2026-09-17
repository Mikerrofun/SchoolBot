// Homework domain types: entries, views, save results, admin review.

import type { Lesson } from "./schedule";

export type HomeworkStatus = "PENDING" | "APPROVED";

export type HomeworkEntry = {
  id: number;
  lessonId: number;
  text: string;
  pendingText: string | null;
  pendingCreatedBy: string | null;
  status: HomeworkStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Homework fields shown in views: approved text plus the pending one. */
export type HomeworkView = {
  text: string;
  pendingText: string | null;
  status: HomeworkStatus;
};

/** Lesson with its (possibly absent) homework text and moderation status. */
export type LessonWithHomework = Lesson & {
  homework: HomeworkView | null;
};

/** One row of the "whole day in one message" homework view. */
export type DayHomeworkRow = {
  lesson: Lesson;
  homework: HomeworkView | null;
};

/** Whole-day homework view: lesson rows plus the day's "Additional" text. */
export type DayHomework = {
  rows: DayHomeworkRow[];
  additional: string | null;
};

export type DayHomeworkOptions = {
  /** Admins additionally see the text waiting for approval. */
  includePending?: boolean;
};

/** Homework joined with its lesson — used for admin approve/reject flows. */
export type HomeworkWithLesson = HomeworkEntry & {
  lesson: Lesson;
};

export type HomeworkSaveAction =
  | "created"
  | "updated"
  | "kept"
  | "duplicate_saved"
  /** AI unavailable — verdict unknown, saved as PENDING for manual review. */
  | "pending_ai_down";

export type SaveHomeworkParams = {
  lessonId: number;
  text: string;
  createdBy?: string;
};

/**
 * Result when homework is created for the first time: there is no previous
 * text at all, so the result carries no `oldText` field whatsoever.
 */
export type SaveHomeworkCreated = {
  id: number;
  action: "created";
  text: string;
  aiUsed: false;
  /** First-time homework is approved immediately. */
  status: "APPROVED";
};

/**
 * Result when homework already existed: the previously approved text is
 * always known and strictly required.
 */
export type SaveHomeworkReplaced = {
  id: number;
  action: Exclude<HomeworkSaveAction, "created">;
  text: string;
  /** The previously approved text that the submission is waiting against. */
  oldText: string;
  aiUsed: boolean;
  status: HomeworkStatus;
};

export type SaveHomeworkResult = SaveHomeworkCreated | SaveHomeworkReplaced;

/** Why a homework submission was sent to admins for approval. */
export type AdminReviewReason = "same_false" | "ai_down";

type NotificationBase = {
  homeworkId: number;
  reason: AdminReviewReason;
  authorId: string;
  /** Human-readable author (name / username); undefined when unknown. */
  authorDisplay?: string;
  subject: string;
  date: Date;
  text: string;
};

/** The submission replaces an existing homework — old text is always present. */
export type ReplacedHomeworkNotification = NotificationBase & {
  /** Previously approved text, so the admin can compare. */
  oldText: string;
};

/** First-time submission — there was no previous homework text. */
export type CreatedHomeworkNotification = NotificationBase;

export type NewHomeworkNotification =
  | ReplacedHomeworkNotification
  | CreatedHomeworkNotification;
