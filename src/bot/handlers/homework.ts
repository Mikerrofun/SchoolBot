import type { Bot } from "grammy";
import type { MyContext } from "../bot";
import {
  DAY_LABELS,
  WEEK_LABELS,
  dateKey,
  dayKeyFromDate,
  formatDate,
  parseDateKey,
  weekDates,
  weekRange,
  type WeekOffset,
} from "@/lib/weeks";
import { prisma } from "@/lib/prisma";
import { getLessonsInRange, groupByDay } from "@/services/schedule.service";
import { saveHomework } from "@/services/homework.service";
import { backKeyboard, dayKeyboard, lessonKeyboard, weekKeyboard } from "../keyboards";

const VIEW_PICK_TEXT = "📝 Домашнее задание\n\nВыбери неделю:";
const ADD_PICK_TEXT = "✏️ Добавить ДЗ\n\nВыбери неделю:";

const ACTION_LABEL = {
  created: "✅ ДЗ записано",
  updated: "✅ ДЗ обновлено (AI улучшил формулировку)",
  kept: "ℹ️ Такое ДЗ уже записано — оставил как есть",
  duplicate_saved: "✅ ДЗ записано",
} as const;

export function registerHomeworkHandlers(bot: Bot<MyContext>) {
  bot.command("дз", (ctx) =>
    ctx.reply(VIEW_PICK_TEXT, { reply_markup: weekKeyboard("hwv") })
  );
  bot.command("добавить", (ctx) =>
    ctx.reply(ADD_PICK_TEXT, { reply_markup: weekKeyboard("hwa") })
  );

  bot.callbackQuery("hwv:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(VIEW_PICK_TEXT, {
      reply_markup: weekKeyboard("hwv"),
    });
  });

  bot.callbackQuery("hwa:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADD_PICK_TEXT, {
      reply_markup: weekKeyboard("hwa"),
    });
  });

  // Week selected -> day list (days that actually have lessons).
  bot.callbackQuery(/^(hwv|hwa):w:(-1|0|1)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, flow, offsetRaw] = ctx.match!;
    const offset = Number(offsetRaw) as WeekOffset;
    const [from, to] = weekRange(offset);
    const lessons = await getLessonsInRange(from, to);

    if (lessons.length === 0) {
      await ctx.editMessageText(
        `На этой неделе (${formatDate(from)} – ${formatDate(to)}) уроков пока нет.`,
        { reply_markup: weekKeyboard(flow as "hwv" | "hwa") }
      );
      return;
    }

    const byDay = groupByDay(lessons);
    const days = weekDates(offset)
      .filter((d) => byDay.has(dayKeyFromDate(d)))
      .map((d) => ({
        dateKey: dateKey(d),
        day: dayKeyFromDate(d),
      }));

    const title =
      flow === "hwv"
        ? `📝 Домашнее задание — ${WEEK_LABELS[offset]}`
        : `✏️ Добавить ДЗ — ${WEEK_LABELS[offset]}`;

    await ctx.editMessageText(`${title}\n\nВыбери день:`, {
      reply_markup: dayKeyboard(flow as "hwv" | "hwa", offset, days),
    });
  });

  // Day selected -> lesson list.
  bot.callbackQuery(/^(hwv|hwa):d:(-1|0|1):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, flow, offsetRaw, dayDateKey] = ctx.match!;
    const offset = Number(offsetRaw) as WeekOffset;
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    const [from, to] = weekRange(offset);
    const lessons = (await getLessonsInRange(from, to)).filter(
      (l) => dateKey(l.date) === dayDateKey
    );

    const title = `${DAY_LABELS[dayKeyFromDate(date)]} (${formatDate(date)})`;
    await ctx.editMessageText(`${title}\n\nВыбери урок:`, {
      reply_markup: lessonKeyboard(flow as "hwv" | "hwa", offset, dayDateKey, lessons),
    });
  });

  // Lesson selected in view flow -> show homework text.
  bot.callbackQuery(/^hwv:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, offsetRaw, dateKey, lessonIdRaw] = ctx.match!;
    const offset = Number(offsetRaw) as WeekOffset;
    const lessonId = Number(lessonIdRaw);
    const date = parseDateKey(dateKey);
    if (!date) return;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { homework: true },
    });
    if (!lesson) {
      await ctx.editMessageText("Урок не найден.");
      return;
    }

    const text = lesson.homework
      ? `📝 ДЗ:\n${lesson.homework.text}`
      : "📝 ДЗ: нет";

    await ctx.editMessageText(
      `📚 ${lesson.subject}\n${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}\n\n${text}`,
      { reply_markup: backKeyboard("hwv", offset, dateKey) }
    );
  });

  // Lesson selected in add flow -> ask for homework text.
  bot.callbackQuery(/^hwa:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, , dateKey, lessonIdRaw] = ctx.match!;
    const lessonId = Number(lessonIdRaw);
    const date = parseDateKey(dateKey);
    if (!date) return;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      await ctx.editMessageText("Урок не найден.");
      return;
    }

    ctx.session.pending = {
      lessonId: lesson.id,
      subject: lesson.subject,
      dateKey,
    };

    await ctx.reply(
      `✏️ ${lesson.subject} — ${formatDate(date)}\n\nОтправь текст домашнего задания одним сообщением.`
    );
  });

  // Text message while a lesson is pending -> save homework.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending) return;

    ctx.session.pending = undefined;

    const result = await saveHomework({
      lessonId: pending.lessonId,
      text: ctx.message.text,
      createdBy: String(ctx.from?.id ?? ""),
    });

    await ctx.reply(
      `${ACTION_LABEL[result.action]}\n\n📚 ${pending.subject}\n📝 ДЗ:\n${result.text}`
    );
  });
}
