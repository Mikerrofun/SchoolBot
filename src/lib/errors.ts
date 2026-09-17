// Central error registry: every error has a stable code and one
// user-friendly message. Handlers and services throw BotError (or read
// ERROR_REGISTRY for user-facing refusal texts); the webhook route
// serializes errors into the structured JSON response.

import type { ErrorCode } from "@/types";

/** User-friendly messages, one per code — the single place to edit texts. */
export const ERROR_REGISTRY: Record<ErrorCode, string> = {
  UNKNOWN: "Произошла ошибка, попробуйте позже.",
  BOT_NOT_CONFIGURED: "Бот не настроен: отсутствует токен.",
  UNAUTHORIZED: "Неавторизованный запрос.",
  AI_UNAVAILABLE: "AI-проверка временно недоступна, попробуйте позже.",
  CONTENT_REJECTED:
    "❌ Текст не похож на запись по делу (домашнее задание) — сохранять его нельзя. Отправь текст по теме.",
};

/** Thrown anywhere in handlers/services; caught by the webhook / bot.catch. */
export class BotError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string = ERROR_REGISTRY[code]) {
    super(message);
    this.name = "BotError";
    this.code = code;
  }
}

/** Normalizes any thrown value into a BotError with a registry code. */
export function toBotError(error: unknown): BotError {
  if (error instanceof BotError) return error;
  return new BotError("UNKNOWN");
}
