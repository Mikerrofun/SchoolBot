import type { Bot } from "grammy";
import { checkTextOnTopic } from "@/lib/ai";
import { ERROR_REGISTRY } from "@/lib/errors";
import { parseDateKey } from "@/lib/weeks";
import { saveHomework } from "@/services/homework.service";
import { getLessonById } from "@/services/schedule.service";
import { getUserByTelegramId } from "@/services/user.service";
import type { MyContext, WeekOffset } from "@/types";
import { daysReplyKeyboard, lessonKeyboard } from "../keyboards";
import {
  HOMEWORK_ADD_TITLE_PREFIX,
  HOMEWORK_PENDING_AI_DOWN_TEXT,
  HOMEWORK_PENDING_SAVED_TEXT,
  LESSON_NOT_FOUND_TEXT,
  PICK_DAY_TEXT,
  flowWeekTitle,
  formatUserDisplay,
  homeworkInputPrompt,
  homeworkSavedMessage,
} from "../messages";
import { notifyAdminsNewHomework } from "./admin";
import { startFlow } from "./navigation";

export function registerHomeworkHandlers(bot: Bot<MyContext>) {
  bot.command("дз", (ctx) => startFlow(ctx, "hwv"));
  bot.command("добавить", (ctx) => startFlow(ctx, "hwa"));

  // « Дни from the inline lesson picker — back to the reply day picker.
  bot.callbackQuery(/^hwa:days:(-1|0|1)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const offset = Number(ctx.match![1]) as WeekOffset;
    ctx.session.pending = undefined;
    ctx.session.flow = "hwa";
    ctx.session.weekOffset = offset;
    await ctx.reply(
      `${flowWeekTitle(HOMEWORK_ADD_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`,
      { reply_markup: daysReplyKeyboard("hwa") }
    );
  });

  // Lesson selected in the add flow -> ask for homework text.
  bot.callbackQuery(/^hwa:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, , dayDateKey, lessonIdRaw] = ctx.match!;
    const lessonId = Number(lessonIdRaw);
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      await ctx.reply(LESSON_NOT_FOUND_TEXT);
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

  // Free text while a lesson is pending -> censor, then save homework.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending || pending.type !== "lesson") return;

    ctx.session.pending = undefined;

    // Censorship before anything is saved; a rejection creates nothing.
    const verdict = await checkTextOnTopic(ctx.message.text);
    if (verdict === false) {
      await ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED);
      return;
    }

    const authorId = String(ctx.from?.id ?? "");

    const result = await saveHomework({
      lessonId: pending.lessonId,
      text: ctx.message.text,
      createdBy: authorId,
    });

    if (result.status === "PENDING") {
      const aiDown = result.action === "pending_ai_down";
      await ctx.reply(aiDown ? HOMEWORK_PENDING_AI_DOWN_TEXT : HOMEWORK_PENDING_SAVED_TEXT);
      const date = parseDateKey(pending.dateKey);
      if (date) {
        // PENDING implies the homework replaced an existing one,
        // so the strict oldText is always available here.
        const user = await getUserByTelegramId(authorId);
        await notifyAdminsNewHomework(bot, {
          homeworkId: result.id,
          reason: aiDown ? "ai_down" : "same_false",
          authorId,
          authorDisplay: user ? formatUserDisplay(user) : undefined,
          subject: pending.subject,
          date,
          oldText: result.oldText,
          text: result.text,
        });
      }
      return;
    }

    await ctx.reply(homeworkSavedMessage(result.action, pending.subject, result.text));
  });
}
