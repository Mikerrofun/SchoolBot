// All user-facing bot texts live here — constants and pure template helpers.
// Handlers and keyboards must not hardcode message strings.
// Error texts are NOT here — they come from the registry (src/lib/errors.ts).

import {
  DAY_LABELS,
  WEEK_LABELS,
  dayKeyFromDate,
  formatDate,
} from "@/lib/weeks";
import { shortSubject } from "@/lib/subjects";
import type {
  AdditionalReviewNotification,
  DayHomeworkRow,
  DayKey,
  HomeworkSaveAction,
  NewHomeworkNotification,
  UserDisplayInfo,
  WeekDayLessons,
  WeekOffset,
} from "@/types";

// ── Menu ────────────────────────────────────────────────────────────────────

export const START_TEXT = `👋 Привет! Это бот класса.

Здесь можно посмотреть расписание и домашнее задание на прошлую, текущую и следующую неделю, а также записать новое ДЗ.

Выбери действие кнопкой под полем ввода:`;

// ── Shared ──────────────────────────────────────────────────────────────────

export const PICK_WEEK_TEXT = "Выбери неделю:";
export const PICK_DAY_TEXT = "Выбери день:";
export const PICK_LESSON_TEXT = "Выбери урок:";
export const NO_LESSONS_TEXT = "Уроков нет";
export const LESSON_NOT_FOUND_TEXT = "Урок не найден.";
/** Placeholder for empty values in views ("Дополнительно: —"). */
export const EMPTY_VALUE_TEXT = "—";
export const NOT_ADMIN_ALERT_TEXT = "Подтвердить может только админ.";
export const REVIEW_APPROVED_MARK = "✅ Подтверждено админом";
export const REVIEW_REJECTED_MARK = "❌ Отклонено админом";

// ── Button labels (reply keyboards + inline) ────────────────────────────────

export const BTN_SCHEDULE = "📅 Расписание";
export const BTN_HOMEWORK_VIEW = "📝 Домашнее задание";
export const BTN_HOMEWORK_ADD = "✏️ Добавить ДЗ";
export const BTN_ADDITIONAL_VIEW = "📌 Дополнительно";
export const BTN_ADDITIONAL_ADD = "✏️ Дополнительно";
export const BTN_MENU = "« Меню";
export const BTN_WEEKS = "« Недели";
export const BTN_DAYS = "« Дни";
export const BTN_APPROVE = "✅ Подтвердить";
export const BTN_REJECT = "❌ Отклонить";

// ── Day labels ──────────────────────────────────────────────────────────────

/** Short weekday labels used as reply-keyboard day buttons. */
export const DAY_SHORT_LABELS: Record<DayKey, string> = {
  MONDAY: "Пн",
  TUESDAY: "Вт",
  WEDNESDAY: "Ср",
  THURSDAY: "Чт",
  FRIDAY: "Пт",
  SATURDAY: "Сб",
  SUNDAY: "Вс",
};

/** School week: Monday–Friday reply buttons in order. */
export const SCHOOL_DAY_SHORT_LABELS: readonly string[] = [
  DAY_SHORT_LABELS.MONDAY,
  DAY_SHORT_LABELS.TUESDAY,
  DAY_SHORT_LABELS.WEDNESDAY,
  DAY_SHORT_LABELS.THURSDAY,
  DAY_SHORT_LABELS.FRIDAY,
];

// ── Schedule ────────────────────────────────────────────────────────────────

export const SCHEDULE_TITLE = "📅 Расписание";
export const SCHEDULE_EMPTY_TEXT = "Расписание пока не заполнено.";

export function dayTitle(date: Date): string {
  return DAY_LABELS[dayKeyFromDate(date)];
}

/** The whole week in one message: "День (дата)" + numbered lessons, no homework. */
export function scheduleWeekMessage(days: WeekDayLessons[]): string {
  const lines: string[] = [SCHEDULE_TITLE, ""];
  let total = 0;
  for (const { date, lessons } of days) {
    lines.push(`${dayTitle(date)} (${formatDate(date)})`);
    if (lessons.length === 0) {
      lines.push(EMPTY_VALUE_TEXT);
    } else {
      for (const lesson of lessons) {
        lines.push(`${lesson.lessonNumber}. ${shortSubject(lesson.subject)}`);
      }
    }
    lines.push("");
    total += lessons.length;
  }
  if (total === 0) return SCHEDULE_EMPTY_TEXT;
  return lines.join("\n").trimEnd();
}

// ── Homework: flows ─────────────────────────────────────────────────────────

export const HOMEWORK_VIEW_PICK_TEXT = `📝 Домашнее задание\n\n${PICK_WEEK_TEXT}`;
export const HOMEWORK_ADD_PICK_TEXT = `✏️ Добавить ДЗ\n\n${PICK_WEEK_TEXT}`;
export const HOMEWORK_VIEW_TITLE_PREFIX = "📝 Домашнее задание";
export const HOMEWORK_ADD_TITLE_PREFIX = "✏️ Добавить ДЗ";

export function flowWeekTitle(prefix: string, offset: WeekOffset): string {
  return `${prefix} — ${WEEK_LABELS[offset]}`;
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
  const header = `${dayTitle(date)}, ${formatDate(date)}`;
  const lines: string[] = [header, ""];

  if (rows.length === 0) {
    lines.push(NO_LESSONS_TEXT, "");
  } else {
    for (const { lesson, homework } of rows) {
      lines.push(`📚 ${shortSubject(lesson.subject)}`);
      // An empty approved text (a rejected first-time pending entry)
      // reads as "nothing saved".
      lines.push(homework?.text || EMPTY_VALUE_TEXT);
      // Admins additionally see the text waiting for approval, if any.
      if (viewerIsAdmin && homework?.pendingText) {
        lines.push(`${PENDING_MARK}`);
        lines.push(homework.pendingText);
      }
      lines.push("");
    }
  }

  lines.push(`📌 Дополнительно: ${additional || EMPTY_VALUE_TEXT}`);
  return lines.join("\n").trimEnd();
}

// ── Homework: input & save results ──────────────────────────────────────────

export function homeworkInputPrompt(subject: string, date: Date): string {
  return `✏️ ${shortSubject(subject)} — ${formatDate(date)}\n\nОтправь текст домашнего задания одним сообщением.`;
}

export const HOMEWORK_SAVED_TEXTS: Record<HomeworkSaveAction, string> = {
  created: "✅ ДЗ записано",
  updated: "✅ ДЗ обновлено (AI улучшил формулировку)",
  kept: "ℹ️ Такое ДЗ уже записано — оставил как есть",
  // Never shown: the PENDING branch replies with HOMEWORK_PENDING_*_TEXT
  // before this dictionary is reached; the key exists to keep types total.
  pending_ai_down: "⏳ ДЗ отправлено на проверку",
};

export const HOMEWORK_PENDING_SAVED_TEXT =
  "⏳ ДЗ отличается от прошлого и отправлено админу на подтверждение.";

export const HOMEWORK_PENDING_AI_DOWN_TEXT =
  "⚠️ AI-проверка временно недоступна — ДЗ отправлено админу на ручную проверку.";

export function homeworkSavedMessage(
  action: HomeworkSaveAction,
  subject: string,
  text: string
): string {
  return `${HOMEWORK_SAVED_TEXTS[action]}\n\n📚 ${shortSubject(subject)}\n📝 ДЗ:\n${text}`;
}

// ── Additional ("Дополнительно") ────────────────────────────────────────────

export const ADDITIONAL_VIEW_PICK_TEXT = `📌 Дополнительно\n\n${PICK_WEEK_TEXT}`;
export const ADDITIONAL_ADD_TITLE_PREFIX = "📌 Дополнительно — добавление";
export const ADDITIONAL_ADD_PICK_TEXT = `${ADDITIONAL_ADD_TITLE_PREFIX}\n\n${PICK_WEEK_TEXT}`;
export const ADDITIONAL_SAVED_TEXT = "✅ Сохранено";
export const ADDITIONAL_PENDING_AI_DOWN_TEXT =
  "⚠️ AI-проверка временно недоступна — запись отправлена админу на ручную проверку.";

/** One message for the whole week: "Пн: текст" per day, "—" when empty. */
export function additionalWeekMessage(
  offset: WeekOffset,
  rows: { date: Date; text: string | null }[]
): string {
  const lines: string[] = [`📌 Дополнительно — ${WEEK_LABELS[offset]}`, ""];
  for (const { date, text } of rows) {
    lines.push(
      `${DAY_SHORT_LABELS[dayKeyFromDate(date)]}: ${text ?? EMPTY_VALUE_TEXT}`
    );
  }
  return lines.join("\n");
}

export function additionalInputPrompt(date: Date): string {
  return `✏️ Дополнительно — ${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}\n\nОтправь текст одним сообщением.`;
}

// ── Admin approval ──────────────────────────────────────────────────────────

export const REVIEW_REASON_SAME_FALSE =
  "🆕 Новое ДЗ отличается от прошлого — на подтверждении:";
export const REVIEW_REASON_AI_DOWN =
  "⚠️ AI-проверка недоступна, проверьте вручную — ДЗ на подтверждении:";

/** "Имя @username (id: 123)", or just the id when the user record is missing. */
export function authorLine(authorId: string, authorDisplay?: string): string {
  return authorDisplay
    ? `👤 Автор: ${authorDisplay} (id: ${authorId})`
    : `👤 Автор: id: ${authorId}`;
}

/** "Иван Иванов @ivanov" from the stored user profile. */
export function formatUserDisplay(user: UserDisplayInfo): string {
  const name = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();
  return [name, user.username ? `@${user.username}` : ""]
    .filter(Boolean)
    .join(" ");
}

export function adminReviewMessage(params: NewHomeworkNotification): string {
  const reason =
    params.reason === "ai_down" ? REVIEW_REASON_AI_DOWN : REVIEW_REASON_SAME_FALSE;

  const lines = [
    reason,
    authorLine(params.authorId, params.authorDisplay),
    `📚 ${shortSubject(params.subject)}, ${DAY_LABELS[dayKeyFromDate(params.date)]}, ${formatDate(params.date)}`,
    "",
  ];

  if ("oldText" in params) {
    lines.push("Прошлое ДЗ:", params.oldText, "");
    lines.push("Новое ДЗ:", params.text);
  } else {
    lines.push("Новое ДЗ (старого текста не было):", params.text);
  }

  return lines.join("\n");
}

export const HOMEWORK_APPROVED_TEXT = "✅ Твоё ДЗ подтверждено";
export const HOMEWORK_REJECTED_TEXT =
  "❌ Твоё ДЗ отклонено админом — осталось прежнее ДЗ";

export const ADDITIONAL_APPROVED_TEXT =
  "✅ Твоя запись в «Дополнительно» подтверждена";
export const ADDITIONAL_REJECTED_TEXT =
  "❌ Твоя запись в «Дополнительно» отклонена админом";

/** Admin notice for an "Additional" entry saved while the AI was down. */
export function adminAdditionalReviewMessage(
  params: AdditionalReviewNotification
): string {
  return [
    REVIEW_REASON_AI_DOWN,
    authorLine(params.authorId, params.authorDisplay),
    `📌 Дополнительно, ${DAY_LABELS[dayKeyFromDate(params.date)]}, ${formatDate(params.date)}`,
    "",
    "Новая запись:",
    params.text,
  ].join("\n");
}
