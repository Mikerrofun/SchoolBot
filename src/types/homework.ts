// Homework and "Additional" section types, including the save-result union
// and the admin-notification payload.

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

export type AdditionalEntry = {
  id: number;
  date: Date;
  text: string;
  authorId: string | null;
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

/** Homework joined with its lesson — used for admin approve/reject flows. */
export type HomeworkWithLesson = HomeworkEntry & {
  lesson: Lesson;
};

/**
 * Result of saving homework, split by whether the record existed before:
 * - created for the first time — there is no previous text at all,
 *   so the result carries no `oldText` field;
 * - saved against an existing record — the previously approved text is
 *   always known and strictly required.
 */
export type HomeworkCreatedResult = {
  id: number;
  action: "created";
  text: string;
  aiUsed: false;
  status: HomeworkStatus;
};

export type HomeworkExistingResult = {
  id: number;
  action:
    | "updated"
    | "kept"
    | "duplicate_saved"
    /** AI unavailable — verdict unknown, saved as PENDING for manual review. */
    | "pending_ai_down";
  text: string;
  /** The previously approved text that the submission is waiting against. */
  oldText: string;
  aiUsed: boolean;
  status: HomeworkStatus;
};

export type SaveHomeworkResult =
  | HomeworkCreatedResult
  | HomeworkExistingResult;

/** Why a homework submission was sent to admins for approval. */
export type AdminReviewReason = "new" | "same_false" | "ai_down";

/**
 * Admin notification about a homework submission. Mirrors the save-result
 * union: a first-time submission has no `oldText`, a replacement always
 * carries the previous approved text as a strict string.
 */
export type NewHomeworkNotification = {
  homeworkId: number;
  reason: AdminReviewReason;
  authorId: string;
  /** Display name from the User table, when the author is known. */
  authorName?: string | null;
  authorUsername?: string | null;
  subject: string;
  date: Date;
  text: string;
} & ({ oldText: string } | { oldText?: undefined });
