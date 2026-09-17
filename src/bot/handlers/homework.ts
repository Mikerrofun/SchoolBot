import type { Bot } from "grammy";
import { checkTextRelevance } from "@/lib/ai";
import { ERROR_MESSAGES } from "@/lib/errors";
import { parseDateKey } from "@/lib/weeks";
import { getLessonById } from "@/services/schedule.service";
import { saveHomework } from "@/services/homework.service";
import type { AdminReviewReason, MyContext, NewHomeworkNotification } from "@/types";
import { pendingInputReply } from "../keyboards";
import {
  ERROR_HOMEWORK_NOT_RELEVANT,
  HOMEWORK_PENDING_AI_DOWN_TEXT,
  HOMEWORK_PENDING_SAVED_TEXT,
  LESSON_NOT_FOUND_TEXT,
  homeworkInputPrompt,
  homeworkSavedMessage,
} from "../messages";
import { notifyAdminsNewHomework } from "./admin";
import { showWeeksForFlow } from "./navigation";

export function registerHomeworkHandlers(bot: Bot<MyContext>) {
  bot.command("дз", (ctx) => showWeeksForFlow(ctx, "hwv"));
  bot.command("добавить", (ctx) => showWeeksForFlow(ctx, "hwa"));

  // Lesson selected (inline) in the add flow -> ask for homework text.
  bot.callbackQuery(/^hwa:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, offsetRaw, dayDateKey, lessonIdRaw] = ctx.match!;
    const lessonId = Number(lessonIdRaw);
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      await ctx.editMessageText(LESSON_NOT_FOUND_TEXT);
      return;
    }

    ctx.session.nav = { flow: "hwa", offset: Number(offsetRaw) as -1 | 0 | 1 };
    ctx.session.pending = {
      type: "lesson",
      lessonId: lesson.id,
      subject: lesson.subject,
      dateKey: dayDateKey,
    };

    await ctx.reply(homeworkInputPrompt(lesson.subject, date), {
      reply_markup: pendingInputReply(),
    });
  });

  // Free text while a lesson is pending -> moderate, then save homework.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending || pending.type !== "lesson") return;

    ctx.session.pending = undefined;

    // AI moderation before anything is stored. Both outcomes (irrelevant
    // text, AI unavailable) are explicit rejections with registry messages.
    const relevance = await checkTextRelevance(ctx.message.text);
    if (!relevance) {
      await ctx.reply(ERROR_MESSAGES.AI_UNAVAILABLE);
      return;
    }
    if (!relevance.relevant) {
      await ctx.reply(ERROR_MESSAGES.HOMEWORK_NOT_RELEVANT);
      return;
    }

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
        const reason: AdminReviewReason =
          result.action === "created" ? "new" : aiDown ? "ai_down" : "same_false";

        // The save-result union guarantees oldText exactly when the homework
        // replaced an existing record; a first-time submission has none.
        const notification: NewHomeworkNotification =
          result.action === "created"
            ? {
                homeworkId: result.id,
                reason,
                authorId: String(ctx.from?.id ?? ""),
                subject: pending.subject,
                date,
                text: result.text,
              }
            : {
                homeworkId: result.id,
                reason,
                authorId: String(ctx.from?.id ?? ""),
                subject: pending.subject,
                date,
                text: result.text,
                oldText: result.oldText,
              };

        await notifyAdminsNewHomework(bot, notification);
      }
      return;
    }

    await ctx.reply(
      homeworkSavedMessage(result.action, pending.subject, result.text)
    );
  });
}
