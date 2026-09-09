import { InlineKeyboard } from "grammy";
import { DAY_LABELS, WEEK_LABELS, type WeekOffset } from "@/lib/weeks";

export type Flow = "sched" | "hwv" | "hwa";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📅 Расписание", "sched:pick")
    .row()
    .text("📝 Домашнее задание", "hwv:pick")
    .row()
    .text("✏️ Добавить ДЗ", "hwa:pick");
}

export function weekKeyboard(flow: Flow): InlineKeyboard {
  const kb = new InlineKeyboard();
  ([-1, 0, 1] as WeekOffset[]).forEach((offset, i) => {
    if (i > 0) kb.row();
    kb.text(WEEK_LABELS[offset], `${flow}:w:${offset}`);
  });
  kb.row().text("« Меню", "menu");
  return kb;
}

export function dayKeyboard(
  flow: Flow,
  offset: WeekOffset,
  days: { dateKey: string; day: keyof typeof DAY_LABELS }[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  days.forEach(({ dateKey, day }, i) => {
    if (i > 0) kb.row();
    kb.text(DAY_LABELS[day], `${flow}:d:${offset}:${dateKey}`);
  });
  kb.row().text("« Недели", `${flow}:pick`).text("Меню", "menu");
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
  kb.text("« Дни", `${flow}:w:${offset}`).text("Меню", "menu");
  return kb;
}

export function backKeyboard(flow: Flow, offset: WeekOffset, dateKey: string) {
  return new InlineKeyboard()
    .text("« Уроки", `${flow}:d:${offset}:${dateKey}`)
    .text("Меню", "menu");
}
