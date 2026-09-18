// Bot runtime types: navigation flows, session, context.

import type { Context, SessionFlavor } from "grammy";
import type { WeekOffset } from "./schedule";

/** Navigation flows behind the reply-keyboard buttons. */
export type Flow = "hwv" | "hwa" | "adv" | "ada";

/** One tappable lesson option of the add-homework day picker. */
export type LessonChoice = {
  lessonId: number;
  /** Reply-button label, e.g. "1. Физра" — unique within the day. */
  label: string;
  subject: string;
  dateKey: string;
};

export type PendingInput =
  | { type: "lesson"; lessonId: number; subject: string; dateKey: string }
  | { type: "additional"; dateKey: string };

export type SessionData = {
  /** What the user is currently typing free text for. */
  pending?: PendingInput;
  /** Which flow the reply-keyboard navigation is currently in. */
  flow?: Flow;
  /** Week chosen within the current flow. */
  weekOffset?: WeekOffset;
  /** Lesson reply-buttons currently shown for the add-homework flow. */
  lessonChoices?: LessonChoice[];
};

export type MyContext = Context & SessionFlavor<SessionData>;
