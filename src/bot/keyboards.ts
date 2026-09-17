import { InlineKeyboard, Keyboard } from "grammy";
import { WEEK_LABELS } from "@/lib/weeks";
import type { Flow, WeekOffset } from "@/types";
import {
  BTN_ADDITIONAL_ADD,
  BTN_ADDITIONAL_VIEW,
  BTN_APPROVE,
  BTN_DAYS,
  BTN_HOMEWORK_ADD,
  BTN_HOMEWORK_VIEW,
  BTN_MENU,
  BTN_REJECT,
  BTN_SCHEDULE,
  BTN_WEEKS,
  DAY_SHORT_LABELS,
} from "./messages";

// ── Reply keyboards: the whole navigation lives under the input field ──────

/** Main menu: the entry points of all five flows. */
export function mainMenuReply(): Keyboard {
  return new Keyboard()
    .text(BTN_SCHEDULE)
    .row()
    .text(BTN_HOMEWORK_VIEW)
    .row()
    .text(BTN_HOMEWORK_ADD)
    .row()
    .text(BTN_ADDITIONAL_VIEW)
    .row()
    .text(BTN_ADDITIONAL_ADD)
    .resized();
}

/** Week picker: previous / current / next week. */
export function weeksReply(): Keyboard {
  const kb = new Keyboard();
  ([-1, 0, 1] as WeekOffset[]).forEach((offset) => kb.text(WEEK_LABELS[offset]));
  return kb.row().text(BTN_MENU).resized();
}

/**
 * Day picker: plain «Пн Вт Ср Чт Пт» (no lesson lists in buttons).
 * The homework flows additionally get the "Дополнительно" shortcut.
 */
export function daysReply(flow: Flow): Keyboard {
  const kb = new Keyboard();
  DAY_SHORT_LABELS.forEach((label) => kb.text(label));
  kb.row();
  if (flow === "hwv" || flow === "hwa") {
    kb.text(BTN_ADDITIONAL_VIEW).row();
  }
  return kb.text(BTN_WEEKS).text(BTN_MENU).resized();
}

/** Keyboard while the user is typing free text (homework / additional). */
export function pendingInputReply(): Keyboard {
  return new Keyboard().text(BTN_MENU).resized();
}

// ── Inline keyboards: lesson pickers and admin actions stay inline ─────────

/** Lessons of the selected day, with an inline « Дни button to go back. */
export function lessonKeyboard(
  flow: Flow,
  offset: WeekOffset,
  dayKey: string,
  lessons: { id: number; lessonNumber: number; subject: string }[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  lessons.forEach((lesson) => {
    kb.text(
      `${lesson.lessonNumber}. ${lesson.subject}`,
      `${flow}:l:${offset}:${dayKey}:${lesson.id}`
    ).row();
  });
  kb.text(BTN_DAYS, `bk:days:${offset}`);
  return kb;
}

export function adminReviewKeyboard(homeworkId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN_APPROVE, `hw:approve:${homeworkId}`)
    .text(BTN_REJECT, `hw:reject:${homeworkId}`);
}
