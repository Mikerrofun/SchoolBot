// All user-facing bot texts live here — constants and pure template helpers.
// Handlers and keyboards must not hardcode message strings.

import {
  DAY_LABELS,
  WEEK_LABELS,
  dayKeyFromDate,
  formatDate,
} from "@/lib/weeks";
import type { DayHomeworkRow, DayKey, WeekOffset } from "@/types";

// ── Menu ────────────────────────────────────────────────────────────────────

export const MENU_TEXT = `👋 Привет! Это бот класса.

Здесь можно посмотреть расписание и домашнее задание на прошлую, текущую и следующую неделю, а также записать новое ДЗ.

Выбери действие:`;

// ── Shared ──────────────────────────────────────────────────────────────────

export const PICK_WEEK_TEXT = "Выбери неделю:";
export const PICK_DAY_TEXT = "Выбери день:";
export const PICK_LESSON_TEXT = "Выбери урок:";
export const NO_LESSONS_TEXT = "Уроков нет";
export const LESSON_NOT_FOUND_TEXT = "Урок не найден.";
export const HOMEWORK_EMPTY_TEXT = "—";
export const BOT_ERROR_TEXT = "Произошла ошибка, попробуйте позже.";
export const NOT_ADMIN_ALERT_TEXT = "Подтвердить может только админ.";
export const REVIEW_APPROVED_MARK = "✅ Подтверждено админом";
export const REVIEW_REJECTED_MARK = "❌ Отклонено админом";

// ── Button labels ───────────────────────────────────────────────────────────

export const BTN_SCHEDULE = "📅 Расписание";
export const BTN_HOMEWORK_VIEW = "📝 Домашнее задание";
export const BTN_HOMEWORK_ADD = "✏️ Добавить ДЗ";
export const BTN_ADDITIONAL_VIEW = "📌 Дополнительно";
export const BTN_ADDITIONAL_ADD = "✏️ Заполнить";
export const BTN_MENU = "« Меню";
export const BTN_WEEKS = "« Недели";
export const BTN_DAYS = "« Дни";
export const BTN_LESSONS = "« Уроки";
export const BTN_APPROVE = "✅ Подтвердить";
export const BTN_REJECT = "❌ Отклонить";

// ── Schedule ────────────────────────────────────────────────────────────────

export const SCHEDULE_PICK_TEXT = `📅 Расписание\n\n${PICK_WEEK_TEXT}`;
export const SCHEDULE_EMPTY_TEXT = "Расписание пока не заполнено.";

export function scheduleWeekHeader(
  offset: WeekOffset,
  from: Date,
  to: Date
): string {
  return `📅 ${WEEK_LABELS[offset]}\n${formatDate(from)} – ${formatDate(to)}`;
}

// ── Homework: flows ─────────────────────────────────────────────────────────

export const HOMEWORK_VIEW_PICK_TEXT = `📝 Домашнее задание\n\n${PICK_WEEK_TEXT}`;
export const HOMEWORK_ADD_PICK_TEXT = `✏️ Добавить ДЗ\n\n${PICK_WEEK_TEXT}`;
export const HOMEWORK_VIEW_TITLE_PREFIX = "📝 Домашнее задание";
export const HOMEWORK_ADD_TITLE_PREFIX = "✏️ Добавить ДЗ";

export function flowWeekTitle(prefix: string, offset: WeekOffset): string {
  return `${prefix} — ${WEEK_LABELS[offset]}`;
}

export function dayTitle(date: Date): string {
  return DAY_LABELS[dayKeyFromDate(date)];
}

/** "Пн: Алгебра, Русский" / "Пн: уроков нет" — label for a day button. */
export function dayButtonLabel(date: Date, subjects: string[]): string {
  const short = DAY_LABELS[dayKeyFromDate(date)].slice(0, 3);
  if (subjects.length === 0) return `${short}: ${NO_LESSONS_TEXT}`;
  return `${short}: ${subjects.join(", ")}`;
}

// ── Homework: whole day in one message ──────────────────────────────────────

const PENDING_MARK = "⏳ на подтверждении";

/** The whole day's homework as a single message; empty lessons show "—". */
export function dayHomeworkMessage(
  date: Date,
  rows: DayHomeworkRow[],
  viewerIsAdmin: boolean
): string {
  const header = `${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}`;
  if (rows.length === 0) return `${header}\n\n${NO_LESSONS_TEXT}`;

  const lines: string[] = [header, ""];
  for (const { lesson, homework } of rows) {
    lines.push(`📚 ${lesson.subject}`);
    lines.push(homework?.text ?? HOMEWORK_EMPTY_TEXT);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// ── Homework: input & save results ──────────────────────────────────────────

export function homeworkInputPrompt(subject: string, date: Date): string {
  return `✏️ ${subject} — ${formatDate(date)}\n\nОтправь текст домашнего задания одним сообщением.`;
}

export const HOMEWORK_SAVED_TEXTS = {
  created: "✅ ДЗ записано",
  updated: "✅ ДЗ обновлено (AI улучшил формулировку)",
  kept: "ℹ️ Такое ДЗ уже записано — оставил как есть",
  duplicate_saved: "✅ ДЗ записано",
} as const;

export const HOMEWORK_PENDING_SAVED_TEXT =
  "⏳ ДЗ отличается от прошлой недели и отправлено админу на подтверждение.";

export function homeworkSavedMessage(
  action: keyof typeof HOMEWORK_SAVED_TEXTS,
  subject: string,
  text: string
): string {
  return `${HOMEWORK_SAVED_TEXTS[action]}\n\n📚 ${subject}\n📝 ДЗ:\n${text}`;
}

// ── Additional ("Дополнительно") ────────────────────────────────────────────

export const ADDITIONAL_VIEW_PICK_TEXT = `📌 Дополнительно\n\n${PICK_WEEK_TEXT}`;
export const ADDITIONAL_ADD_PICK_TEXT = `📌 Дополнительно — заполнение\n\n${PICK_WEEK_TEXT}`;
export const ADDITIONAL_SAVED_TEXT = "✅ Сохранено";

/** One message for the whole week: "Пн: текст" per day, "—" when empty. */
export function additionalWeekMessage(
  offset: WeekOffset,
  rows: { date: Date; text: string | null }[]
): string {
  const lines: string[] = [`📌 Дополнительно — ${WEEK_LABELS[offset]}`, ""];
  for (const { date, text } of rows) {
    lines.push(
      `${DAY_LABELS[dayKeyFromDate(date)].slice(0, 3)}: ${text ?? HOMEWORK_EMPTY_TEXT}`
    );
  }
  return lines.join("\n");
}

export function additionalInputPrompt(date: Date): string {
  return `✏️ Дополнительно — ${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}\n\nОтправь текст одним сообщением.`;
}

// ── Admin approval ──────────────────────────────────────────────────────────

export function adminReviewMessage(params: {
  authorId: string;
  subject: string;
  date: Date;
  text: string;
}): string {
  return [
    "🆕 Новое ДЗ на подтверждении:",
    `👤 Автор: ${params.authorId}`,
    `📚 ${params.subject}, ${DAY_LABELS[dayKeyFromDate(params.date)]}, ${formatDate(params.date)}`,
    "",
    params.text,
  ].join("\n");
}

export const HOMEWORK_APPROVED_TEXT = "✅ Твоё ДЗ подтверждено";
export const HOMEWORK_REJECTED_TEXT = "❌ Твоё ДЗ отклонено админом";
