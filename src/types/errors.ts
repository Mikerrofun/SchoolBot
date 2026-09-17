// Error registry types. The code list is the single source of truth;
// user-facing messages for these codes live in src/lib/errors.ts.

export type BotErrorCode =
  | "UNKNOWN"
  | "AI_UNAVAILABLE"
  | "HOMEWORK_NOT_RELEVANT"
  | "ADDITIONAL_NOT_RELEVANT"
  | "DATABASE_UNAVAILABLE";

/** Machine-readable error payload returned by the webhook. */
export type ErrorInfo = {
  code: BotErrorCode;
  message: string;
};
