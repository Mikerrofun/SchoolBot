// Bot context, session and flow types.

import type { Context, SessionFlavor } from "grammy";
import type { WeekOffset } from "./common";

/** Identifier of the navigation flow the user is currently in. */
export type Flow = "sched" | "hwv" | "hwa" | "adv" | "ada";

export type PendingInput =
  | { type: "lesson"; lessonId: number; subject: string; dateKey: string }
  | { type: "additional"; dateKey: string };

/** Where the user is in the reply-keyboard navigation. */
export type NavState = {
  flow: Flow;
  offset: WeekOffset;
};

export type SessionData = {
  /** What the user is currently typing free text for. */
  pending?: PendingInput;
  /** Current reply-keyboard navigation position. */
  nav?: NavState;
};

export type MyContext = Context & SessionFlavor<SessionData>;
