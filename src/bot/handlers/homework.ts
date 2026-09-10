import type { Bot } from "grammy";
import type { MyContext } from "../bot";
import { dateKey, getWeekWindow, parseDateKey } from "@/lib/weeks";
import type { WeekOffset } from "@/types";
import { isAdmin } from "@/lib/admin";
import { getLessonById, getLessonsInRange, getWeekLessons } from "@/services/schedule.service";
import { getDayHomework, saveHomework } from "@/services/homework.service";
import {
  backKeyboard,
  dayKeyboard,
  lessonKeyboard,
  weekKeyboard,
} from "../keyboards";
import {
  HOMEWORK_ADD_PICK_TEXT,
  HOMEWORK_ADD_TITLE_PREFIX,
  HOMEWORK_PENDING_AI_DOWN_TEXT,
  HOMEWORK_PENDING_SAVED_TEXT,
  HOMEWORK_VIEW_PICK_TEXT,
  HOMEWORK_VIEW_TITLE_PREFIX,
  LESSON_NOT_FOUND_TEXT,
  PICK_DAY_TEXT,
  PICK_LESSON_TEXT,
  dayHomeworkMessage,
  dayTitle,
  flowWeekTitle,
  homeworkInputPrompt,
  homeworkSavedMessage,
} from "../messages";
import { notifyAdminsNewHomework } from "./admin";

export function registerHomeworkHandlers(bot: Bot<MyContext>) {
  bot.command("дз", (ctx) =>
    ctx.reply(HOMEWORK_VIEW_PICK_TEXT, { reply_markup: weekKeyboard("hwv") })
  );
  bot.command("добавить", (ctx) =>
    ctx.reply(HOMEWORK_ADD_PICK_TEXT, { reply_markup: weekKeyboard("hwa") })
  );

  bot.callbackQuery("hwv:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(HOMEWORK_VIEW_PICK_TEXT, {
      reply_markup: weekKeyboard("hwv"),
    });
  });

  bot.callbackQuery("hwa:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(HOMEWORK_ADD_PICK_TEXT, {
      reply_markup: weekKeyboard("hwa"),
    });
  });

  // Week selected -> day picker listing each day's lessons.
  bot.callbackQuery(/^(hwv|hwa):w:(-1|0|1)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, flow, offsetRaw] = ctx.match!;
    const offset = Number(offsetRaw) as WeekOffset;
    const days = await getWeekLessons(getWeekWindow(offset));

    const prefix =
      flow === "hwv" ? HOMEWORK_VIEW_TITLE_PREFIX : HOMEWORK_ADD_TITLE_PREFIX;
    await ctx.editMessageText(`${flowWeekTitle(prefix, offset)}\n\n${PICK_DAY_TEXT}`, {
      reply_markup: dayKeyboard(flow as "hwv" | "hwa", offset, days),
    });
  });

  // Day selected in view flow -> the whole day in one message.
  bot.callbackQuery(/^hwv:d:(-1|0|1):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, offsetRaw, dayDateKey] = ctx.match!;
    const offset = Number(offsetRaw) as WeekOffset;
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    const viewerIsAdmin = isAdmin(ctx.from?.id);
    const rows = await getDayHomework(date, { includePending: viewerIsAdmin });

    await ctx.editMessageText(dayHomeworkMessage(date, rows, viewerIsAdmin), {
      reply_markup: backKeyboard("hwv", offset, dayDateKey),
    });
  });

  // Day selected in add flow -> lesson list (editing scenario).
  bot.callbackQuery(/^hwa:d:(-1|0|1):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, offsetRaw, dayDateKey] = ctx.match!;
    const offset = Number(offsetRaw) as WeekOffset;
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    const window = getWeekWindow(offset);
    const lessons = (await getLessonsInRange(window.start, window.end)).filter(
      (l) => dateKey(l.date) === dayDateKey
    );

    await ctx.editMessageText(`${dayTitle(date)}\n\n${PICK_LESSON_TEXT}`, {
      reply_markup: lessonKeyboard("hwa", offset, dayDateKey, lessons),
    });
  });

  // Lesson selected in add flow -> ask for homework text.
  bot.callbackQuery(/^hwa:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, , dayDateKey, lessonIdRaw] = ctx.match!;
    const lessonId = Number(lessonIdRaw);
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      await ctx.editMessageText(LESSON_NOT_FOUND_TEXT);
      return;
    }

    ctx.session.pending = {
      type: "lesson",
      lessonId: lesson.id,
      subject: lesson.subject,
      dateKey: dayDateKey,
    };

    await ctx.reply(homeworkInputPrompt(lesson.subject, date));
  });

  // Free text while a lesson is pending -> save homework.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending || pending.type !== "lesson") return;

    ctx.session.pending = undefined;

    const result = await saveHomework({
      lessonId: pending.lessonId,
      text: ctx.message.text,
      createdBy: String(ctx.from?.id ?? ""),
    });

    if (result.status === "PENDING") {
      const aiDown = result.action === "pending_ai_down";
      await ctx.reply(aiDown ? HOMEWORK_PENDING_AI_DOWN_TEXT : HOMEWORK_PENDING_SAVED_TEXT);
      const date = parseDateKey(pending.dateKey);
      if (date) {
        await notifyAdminsNewHomework(bot, {
          homeworkId: result.id,
          reason: aiDown ? "ai_down" : "same_false",
          authorId: String(ctx.from?.id ?? ""),
          subject: pending.subject,
          date,
          text: result.text,
        });
      }
      return;
    }

    await ctx.reply(homeworkSavedMessage(result.action, pending.subject, result.text));
  });
}
