import type { Bot } from "grammy";
import { checkTextOnTopic } from "@/lib/ai";
import { ERROR_REGISTRY } from "@/lib/errors";
import { parseDateKey } from "@/lib/weeks";
import { saveHomework } from "@/services/homework.service";
import { getUserByTelegramId } from "@/services/user.service";
import type { MyContext } from "@/types";
import { daysReplyKeyboard } from "../keyboards";
import {
  HOMEWORK_PENDING_AI_DOWN_TEXT,
  HOMEWORK_PENDING_SAVED_TEXT,
  formatUserDisplay,
  homeworkSavedMessage,
} from "../messages";
import { notifyAdminsNewHomework } from "./admin";
import { startFlow } from "./navigation";

export function registerHomeworkHandlers(bot: Bot<MyContext>) {
  bot.command("дз", (ctx) => startFlow(ctx, "hwv"));
  bot.command("добавить", (ctx) => startFlow(ctx, "hwa"));

  // Free text while a lesson is pending -> censor, then save homework.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending || pending.type !== "lesson") return;

    ctx.session.pending = undefined;
    // The lessons reply keyboard is replaced by the day picker below.
    ctx.session.lessonChoices = undefined;

    // Censorship before anything is saved; a rejection creates nothing.
    const verdict = await checkTextOnTopic(ctx.message.text);
    if (verdict === false) {
      await ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED, {
        reply_markup: daysReplyKeyboard("hwa"),
      });
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
      await ctx.reply(
        aiDown ? HOMEWORK_PENDING_AI_DOWN_TEXT : HOMEWORK_PENDING_SAVED_TEXT,
        { reply_markup: daysReplyKeyboard("hwa") }
      );
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

    await ctx.reply(homeworkSavedMessage(result.action, pending.subject, result.text), {
      reply_markup: daysReplyKeyboard("hwa"),
    });
  });
}
