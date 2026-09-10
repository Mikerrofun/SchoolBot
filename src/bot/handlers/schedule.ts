import type { Bot } from "grammy";
import type { MyContext } from "../bot";
import {
  dayKeyFromDate,
  formatDate,
  getWeekWindow,
  weekDates,
} from "@/lib/weeks";
import type { WeekOffset } from "@/types";
import { getLessonsInRange, groupByDay } from "@/services/schedule.service";
import { weekKeyboard } from "../keyboards";
import {
  SCHEDULE_EMPTY_TEXT,
  SCHEDULE_PICK_TEXT,
  dayTitle,
  scheduleWeekHeader,
} from "../messages";

export function registerScheduleHandlers(bot: Bot<MyContext>) {
  bot.command("расписание", (ctx) =>
    ctx.reply(SCHEDULE_PICK_TEXT, { reply_markup: weekKeyboard("sched") })
  );

  bot.callbackQuery("sched:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(SCHEDULE_PICK_TEXT, {
      reply_markup: weekKeyboard("sched"),
    });
  });

  bot.callbackQuery(/^sched:w:(-1|0|1)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const offset = Number(ctx.match![1]) as WeekOffset;
    const window = getWeekWindow(offset);
    const lessons = await getLessonsInRange(window.start, window.end);

    const header = scheduleWeekHeader(offset, window.start, window.end);

    if (lessons.length === 0) {
      await ctx.editMessageText(`${header}\n\n${SCHEDULE_EMPTY_TEXT}`, {
        reply_markup: weekKeyboard("sched"),
      });
      return;
    }

    const byDay = groupByDay(lessons);
    const lines: string[] = [header, ""];

    for (const date of weekDates(offset)) {
      const dayLessons = byDay.get(dayKeyFromDate(date));
      if (!dayLessons || dayLessons.length === 0) continue;

      lines.push(`${dayTitle(date)} (${formatDate(date)})`);
      for (const lesson of dayLessons) {
        lines.push(`${lesson.lessonNumber}. ${lesson.subject}`);
      }
      lines.push("");
    }

    await ctx.editMessageText(lines.join("\n").trimEnd(), {
      reply_markup: weekKeyboard("sched"),
    });
  });
}
