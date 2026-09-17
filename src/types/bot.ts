// Bot runtime types: navigation flows, session, context.

import type { Context, SessionFlavor } from "grammy";
import type { WeekOffset } from "./schedule";

/** Navigation flows behind the reply-keyboard buttons. */
export type Flow = "sched" | "hwv" | "hwa" | "adv" | "ada";

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
};

export type MyContext = Context & SessionFlavor<SessionData>;
