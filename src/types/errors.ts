// Error registry types. The registry itself (codes -> messages, BotError)
// lives in src/lib/errors.ts; the shape of the webhook response lives here.

export type ErrorCode =
  | "UNKNOWN"
  | "BOT_NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "AI_UNAVAILABLE"
  | "CONTENT_REJECTED";

/** Body of the webhook error response: { ok: false, error: { code, message } }. */
export type WebhookErrorPayload = {
  ok: false;
  error: { code: ErrorCode; message: string };
};

/** Body of the webhook success response: { ok: true }. */
export type WebhookSuccessPayload = {
  ok: true;
};
