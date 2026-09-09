import type { Bot } from "grammy";
import type { MyContext } from "../bot";
import {
  DAY_LABELS,
  WEEK_LABELS,
  dayKeyFromDate,
  formatDate,
  weekDates,
  weekRange,
  type WeekOffset,
} from "@/lib/weeks";
import { getLessonsInRange, groupByDay } from "@/services/schedule.service";
import { weekKeyboard } from "../keyboards";

const WEEK_PICK_TEXT = "📅 Расписание\n\nВыбери неделю:";

export function registerScheduleHandlers(bot: Bot<MyContext>) {
  bot.command("расписание", (ctx) =>
    ctx.reply(WEEK_PICK_TEXT, { reply_markup: weekKeyboard("sched") })
  );

  bot.callbackQuery("sched:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(WEEK_PICK_TEXT, {
      reply_markup: weekKeyboard("sched"),
    });
  });

  bot.callbackQuery(/^sched:w:(-1|0|1)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const offset = Number(ctx.match![1]) as WeekOffset;
    const [from, to] = weekRange(offset);
    const lessons = await getLessonsInRange(from, to);

    const header = `📅 ${WEEK_LABELS[offset]}\n${formatDate(from)} – ${formatDate(to)}`;

    if (lessons.length === 0) {
      await ctx.editMessageText(`${header}\n\nРасписание пока не заполнено.`, {
        reply_markup: weekKeyboard("sched"),
      });
      return;
    }

    const byDay = groupByDay(lessons);
    const lines: string[] = [header, ""];

    for (const date of weekDates(offset)) {
      const dayLessons = byDay.get(dayKeyFromDate(date));
      if (!dayLessons || dayLessons.length === 0) continue;

      lines.push(`${DAY_LABELS[dayKeyFromDate(date)]} (${formatDate(date)})`);
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
