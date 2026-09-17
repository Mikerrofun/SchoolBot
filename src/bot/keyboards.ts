import { InlineKeyboard, Keyboard } from "grammy";
import { WEEK_LABELS } from "@/lib/weeks";
import type { Flow, LessonChoice } from "@/types";
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
  SCHOOL_DAY_SHORT_LABELS,
} from "./messages";

// ── Reply keyboards: navigation under the input field, redrawn per step ────

export function mainMenuReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text(BTN_SCHEDULE)
    .row()
    .text(BTN_HOMEWORK_VIEW)
    .row()
    .text(BTN_HOMEWORK_ADD)
    .row()
    .text(BTN_ADDITIONAL_VIEW)
    .resized();
}

export function weeksReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text(WEEK_LABELS[-1])
    .text(WEEK_LABELS[0])
    .text(WEEK_LABELS[1])
    .row()
    .text(BTN_MENU)
    .resized();
}

/** Mon–Fri picker; homework flows also get the "Дополнительно" shortcut. */
export function daysReplyKeyboard(flow: Flow): Keyboard {
  const kb = new Keyboard();
  for (const label of SCHOOL_DAY_SHORT_LABELS) {
    kb.text(label);
  }
  kb.row();
  if (flow === "hwv") kb.text(BTN_ADDITIONAL_VIEW).row();
  if (flow === "hwa") kb.text(BTN_ADDITIONAL_ADD).row();
  return kb.text(BTN_WEEKS).text(BTN_MENU).resized();
}

/** Lesson options for the add flow as reply buttons, with a nav row. */
export function lessonsReplyKeyboard(choices: LessonChoice[]): Keyboard {
  const kb = new Keyboard();
  for (const choice of choices) kb.text(choice.label).row();
  return kb.text(BTN_DAYS).text(BTN_MENU).resized();
}

// ── Inline keyboards: admin review stays in messages ────────────────────────

export function adminReviewKeyboard(homeworkId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN_APPROVE, `hw:approve:${homeworkId}`)
    .text(BTN_REJECT, `hw:reject:${homeworkId}`);
}
