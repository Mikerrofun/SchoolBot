// All user-facing bot texts live here — constants and pure template helpers.
// Handlers and keyboards must not hardcode message strings.

import {
  DAY_LABELS,
  WEEK_LABELS,
  dayKeyFromDate,
  formatDate,
} from "@/lib/weeks";
import { displaySubject } from "@/lib/subjects";
import type {
  AdminReviewReason,
  DayHomeworkRow,
  DayKey,
  WeekOffset,
} from "@/types";

// ── Menu ────────────────────────────────────────────────────────────────────

export const MENU_TEXT = `👋 Привет! Это бот класса.

Здесь можно посмотреть расписание и домашнее задание на прошлую, текущую и следующую неделю, а также записать новое ДЗ.

Выбери действие кнопкой ниже:`;

// ── Shared ──────────────────────────────────────────────────────────────────

export const PICK_WEEK_TEXT = "Выбери неделю:";
export const PICK_DAY_TEXT = "Выбери день:";
export const PICK_LESSON_TEXT = "Выбери урок:";
export const NO_LESSONS_TEXT = "Уроков нет";
export const LESSON_NOT_FOUND_TEXT = "Урок не найден.";
/** Placeholder for empty values in views (never for oldText — see adminReviewMessage). */
export const EMPTY_PLACEHOLDER = "—";
export const NOT_ADMIN_ALERT_TEXT = "Подтвердить может только админ.";
export const REVIEW_APPROVED_MARK = "✅ Подтверждено админом";
export const REVIEW_REJECTED_MARK = "❌ Отклонено админом";

// ── Button labels (shared by reply keyboards and text routing) ─────────────

export const BTN_SCHEDULE = "📅 Расписание";
export const BTN_HOMEWORK_VIEW = "📝 Домашнее задание";
export const BTN_HOMEWORK_ADD = "✏️ Добавить ДЗ";
export const BTN_ADDITIONAL_VIEW = "📌 Дополнительно";
export const BTN_ADDITIONAL_ADD = "✏️ Заполнить Дополнительно";
export const BTN_MENU = "« Меню";
export const BTN_WEEKS = "« Недели";
export const BTN_DAYS = "« Дни";
export const BTN_APPROVE = "✅ Подтвердить";
export const BTN_REJECT = "❌ Отклонить";

/** Reply-keyboard day buttons: plain «Пн Вт Ср Чт Пт», Monday through Friday. */
export const DAY_SHORT_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт"] as const;

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

// ── Homework: whole day in one message ──────────────────────────────────────

const PENDING_MARK = "⏳ на подтверждении:";

/** The whole day's homework as a single message; empty lessons show "—". */
export function dayHomeworkMessage(
  date: Date,
  rows: DayHomeworkRow[],
  additional: string | null,
  viewerIsAdmin: boolean
): string {
  const header = `${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}`;
  const lines: string[] = [header, ""];

  if (rows.length === 0) {
    lines.push(NO_LESSONS_TEXT, "");
  } else {
    for (const { lesson, homework } of rows) {
      lines.push(`📚 ${displaySubject(lesson.subject)}`);
      lines.push(homework?.text ?? EMPTY_PLACEHOLDER);
      // Admins additionally see the text waiting for approval, if any.
      if (viewerIsAdmin && homework?.pendingText) {
        lines.push(`${PENDING_MARK}`);
        lines.push(homework.pendingText);
      }
      lines.push("");
    }
  }

  lines.push(`📌 Дополнительно: ${additional ?? EMPTY_PLACEHOLDER}`);
  return lines.join("\n").trimEnd();
}

// ── Homework: input & save results ──────────────────────────────────────────

export function homeworkInputPrompt(subject: string, date: Date): string {
  return `✏️ ${displaySubject(subject)} — ${formatDate(date)}\n\nОтправь текст домашнего задания одним сообщением.`;
}

export const HOMEWORK_SAVED_TEXTS = {
  created: "✅ ДЗ записано",
  updated: "✅ ДЗ обновлено (AI улучшил формулировку)",
  kept: "ℹ️ Такое ДЗ уже записано — оставил как есть",
  duplicate_saved: "✅ ДЗ записано",
  // Never shown: the PENDING branch replies with HOMEWORK_PENDING_*_TEXT
  // before this dictionary is reached; the key exists to keep types total.
  pending_ai_down: "⏳ ДЗ отправлено на проверку",
} as const;

export const HOMEWORK_PENDING_SAVED_TEXT =
  "⏳ ДЗ отличается от прошлой недели и отправлено админу на подтверждение.";

export const HOMEWORK_PENDING_AI_DOWN_TEXT =
  "⚠️ AI-проверка временно недоступна — ДЗ отправлено админу на ручную проверку.";

export function homeworkSavedMessage(
  action: keyof typeof HOMEWORK_SAVED_TEXTS,
  subject: string,
  text: string
): string {
  return `${HOMEWORK_SAVED_TEXTS[action]}\n\n📚 ${displaySubject(subject)}\n📝 ДЗ:\n${text}`;
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
      `${DAY_LABELS[dayKeyFromDate(date)].slice(0, 3)}: ${text ?? EMPTY_PLACEHOLDER}`
    );
  }
  return lines.join("\n");
}

export function additionalInputPrompt(date: Date): string {
  return `✏️ Дополнительно — ${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}\n\nОтправь текст одним сообщением.`;
}

// ── Admin approval ──────────────────────────────────────────────────────────

export const REVIEW_REASON_NEW =
  "🆕 Новое ДЗ (старого текста не было) — на подтверждении:";
export const REVIEW_REASON_SAME_FALSE =
  "🆕 Новое ДЗ отличается от прошлого — на подтверждении:";
export const REVIEW_REASON_AI_DOWN =
  "⚠️ AI-проверка недоступна, проверьте вручную — ДЗ на подтверждении:";

/**
 * Builds the admin review message. The params mirror the save-result union:
 * a first-time submission has no `oldText` at all (the "Прошлое ДЗ" block is
 * omitted), a replacement always carries the previous text as a strict string.
 */
export function adminReviewMessage(params: {
  reason: AdminReviewReason;
  authorId: string;
  authorName?: string | null;
  authorUsername?: string | null;
  subject: string;
  date: Date;
  text: string;
} & ({ oldText: string } | { oldText?: undefined })): string {
  const reason =
    params.reason === "new"
      ? REVIEW_REASON_NEW
      : params.reason === "ai_down"
        ? REVIEW_REASON_AI_DOWN
        : REVIEW_REASON_SAME_FALSE;

  // Show username and name when known (User table); fall back to bare id
  // for submissions made before user accounts existed.
  const authorParts: string[] = [];
  if (params.authorName) authorParts.push(params.authorName);
  if (params.authorUsername) authorParts.push(`@${params.authorUsername}`);
  authorParts.push(`id: ${params.authorId}`);

  const lines: string[] = [
    reason,
    `👤 Автор: ${authorParts.join(" · ")}`,
    `📚 ${displaySubject(params.subject)}, ${DAY_LABELS[dayKeyFromDate(params.date)]}, ${formatDate(params.date)}`,
    "",
  ];

  if (typeof params.oldText === "string") {
    lines.push("Прошлое ДЗ:", params.oldText, "");
  }

  lines.push("Новое ДЗ:", params.text);
  return lines.join("\n");
}

export const HOMEWORK_APPROVED_TEXT = "✅ Твоё ДЗ подтверждено";
export const HOMEWORK_REJECTED_TEXT =
  "❌ Твоё ДЗ отклонено админом — осталось прежнее ДЗ";
