import { InlineKeyboard } from "grammy";
import { dateKey, dayKeyFromDate, DAY_LABELS, WEEK_LABELS } from "@/lib/weeks";
import type { WeekDayLessons, WeekOffset } from "@/types";
import {
  BTN_ADDITIONAL_VIEW,
  BTN_APPROVE,
  BTN_DAYS,
  BTN_HOMEWORK_ADD,
  BTN_HOMEWORK_VIEW,
  BTN_LESSONS,
  BTN_MENU,
  BTN_REJECT,
  BTN_SCHEDULE,
  BTN_WEEKS,
  dayButtonLabel,
} from "./messages";

export type Flow = "sched" | "hwv" | "hwa" | "adv" | "ada";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN_SCHEDULE, "sched:pick")
    .row()
    .text(BTN_HOMEWORK_VIEW, "hwv:pick")
    .row()
    .text(BTN_HOMEWORK_ADD, "hwa:pick")
    .row()
    .text(BTN_ADDITIONAL_VIEW, "adv:pick");
}

export function weekKeyboard(flow: Flow): InlineKeyboard {
  const kb = new InlineKeyboard();
  ([-1, 0, 1] as WeekOffset[]).forEach((offset, i) => {
    if (i > 0) kb.row();
    kb.text(WEEK_LABELS[offset], `${flow}:w:${offset}`);
  });
  kb.row().text(BTN_MENU, "menu");
  return kb;
}

/**
 * Day picker where every button lists that day's lessons,
 * e.g. "Пн: Алгебра, Русский" or "Пн: уроков нет".
 */
export function dayKeyboard(
  flow: Flow,
  offset: WeekOffset,
  days: WeekDayLessons[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  days.forEach(({ date, lessons }, i) => {
    if (i > 0) kb.row();
    kb.text(
      dayButtonLabel(date, lessons.map((l) => l.subject)),
      `${flow}:d:${offset}:${dateKey(date)}`
    );
  });
  if (flow === "hwv" || flow === "hwa") {
    kb.row().text(BTN_ADDITIONAL_VIEW, `${flow}:extra:${offset}`);
  }
  kb.row().text(BTN_WEEKS, `${flow}:pick`).text(BTN_MENU, "menu");
  return kb;
}

/** Plain Mon–Fri picker without lesson lists (used by "Дополнительно" editing). */
export function simpleDayKeyboard(
  flow: Flow,
  offset: WeekOffset,
  dates: Date[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  dates.forEach((date, i) => {
    if (i > 0) kb.row();
    kb.text(DAY_LABELS[dayKeyFromDate(date)], `${flow}:d:${offset}:${dateKey(date)}`);
  });
  kb.row().text(BTN_WEEKS, `${flow}:pick`).text(BTN_MENU, "menu");
  return kb;
}

export function lessonKeyboard(
  flow: Flow,
  offset: WeekOffset,
  dateKey: string,
  lessons: { id: number; lessonNumber: number; subject: string }[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  lessons.forEach((lesson) => {
    kb.text(
      `${lesson.lessonNumber}. ${lesson.subject}`,
      `${flow}:l:${offset}:${dateKey}:${lesson.id}`
    ).row();
  });
  kb.text(BTN_DAYS, `${flow}:w:${offset}`).text(BTN_MENU, "menu");
  return kb;
}

export function backKeyboard(flow: Flow, offset: WeekOffset, dateKey: string) {
  return new InlineKeyboard()
    .text(BTN_LESSONS, `${flow}:d:${offset}:${dateKey}`)
    .text(BTN_MENU, "menu");
}

export function adminReviewKeyboard(homeworkId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN_APPROVE, `hw:approve:${homeworkId}`)
    .text(BTN_REJECT, `hw:reject:${homeworkId}`);
}
