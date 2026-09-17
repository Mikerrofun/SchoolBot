// Error registry: every user-facing error has a code and a single
// user-friendly message. Handlers and services throw AppError (or reply
// with ERROR_MESSAGES[...]) — no ad-hoc error texts anywhere else.

import type { BotErrorCode, ErrorInfo } from "@/types";

export const ERROR_MESSAGES: Record<BotErrorCode, string> = {
  UNKNOWN: "Произошла ошибка, попробуйте позже.",
  AI_UNAVAILABLE:
    "AI-проверка временно недоступна. Попробуйте отправить текст позже.",
  HOMEWORK_NOT_RELEVANT:
    "Текст не похож на домашнее задание — запись отклонена.",
  ADDITIONAL_NOT_RELEVANT: "Текст не по делу — запись отклонена.",
  DATABASE_UNAVAILABLE:
    "База данных временно недоступна, попробуйте позже.",
};

/** An expected application error with a registry code. */
export class AppError extends Error {
  readonly code: BotErrorCode;

  constructor(code: BotErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
  }
}

/** Maps any thrown value to a registry entry for logs and webhook responses. */
export function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  return { code: "UNKNOWN", message: ERROR_MESSAGES.UNKNOWN };
}

/** Single unified log format for all errors. */
export function logError(scope: string, error: unknown): void {
  const info = toErrorInfo(error);
  console.error(
    `[${scope}] ${info.code}: ${info.message}`,
    error instanceof AppError ? "" : error
  );
}
