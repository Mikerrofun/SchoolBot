// "Additional" (virtual sixth section) domain types.

import type { HomeworkStatus } from "./homework";

export type AdditionalEntry = {
  id: number;
  date: Date;
  text: string;
  pendingText: string | null;
  pendingAuthorId: string | null;
  status: HomeworkStatus;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** One row of the week view: text is null when nothing was saved yet. */
export type AdditionalWeekRow = {
  date: Date;
  text: string | null;
};

/** Admin review request for an "Additional" entry saved while AI was down. */
export type AdditionalReviewNotification = {
  additionalId: number;
  reason: "ai_down";
  authorId: string;
  /** Human-readable author (name / username); undefined when unknown. */
  authorDisplay?: string;
  date: Date;
  text: string;
};
