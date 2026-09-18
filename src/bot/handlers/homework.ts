import type { Bot } from "grammy";
import { censorSubmission } from "../censorship";
import { parseDateKey } from "@/lib/weeks";
import { saveHomework } from "@/services/homework.service";
import { getUserByTelegramId } from "@/services/user.service";
import type { CreatedHomeworkNotification, MyContext } from "@/types";
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
  console.log("🔧 [INIT] Регистрация homework handlers...");
  
  bot.command("дз", (ctx) => startFlow(ctx, "hwv"));
  bot.command("добавить", (ctx) => startFlow(ctx, "hwa"));

  // Free text while a lesson is pending -> censor, then save homework.
  bot.on("message:text", async (ctx, next) => {
    try {
      console.log("📚 [HOMEWORK HANDLER] Проверка входящего сообщения");
      console.log("   - pending:", ctx.session.pending);
      console.log("   - text:", ctx.message.text.substring(0, 50));
      
      const pending = ctx.session.pending;
      if (!pending || pending.type !== "lesson") {
        console.log("⏭️ [HOMEWORK HANDLER] Нет pending урока, пропускаем");
        await next(); // Не наш случай - передаём дальше
        return;
      }

      ctx.session.pending = undefined;
      // The lessons reply keyboard is replaced by the day picker below.
      ctx.session.lessonChoices = undefined;

      console.log("🔍 [HOMEWORK] Обработка домашнего задания:", {
        text: ctx.message.text,
        lessonId: pending.lessonId,
        userId: ctx.from?.id
      });

      // Censorship before anything is saved; a rejection creates nothing.
      // "moderation" means the AI is down: the submission is neither lost
      // nor published unchecked — it goes to the pending moderation flow.
      const verdict = await censorSubmission(ctx, ctx.message.text, "hwa");
      console.log("✅ [HOMEWORK] Результат цензуры:", verdict);
      if (verdict.outcome === "rejected") return;

      const authorId = String(ctx.from?.id ?? "");

      console.log("💾 [HOMEWORK] Сохранение ДЗ...");
      const result = await saveHomework({
        lessonId: pending.lessonId,
        text: ctx.message.text,
        createdBy: authorId,
        censorshipAiDown: verdict.outcome === "moderation",
      });
      console.log("✅ [HOMEWORK] ДЗ сохранено:", { status: result.status, action: result.action });

      if (result.status === "PENDING") {
        const aiDown = result.action === "pending_ai_down";
        await ctx.reply(
          aiDown ? HOMEWORK_PENDING_AI_DOWN_TEXT : HOMEWORK_PENDING_SAVED_TEXT,
          { reply_markup: daysReplyKeyboard("hwa") }
        );
        const date = parseDateKey(pending.dateKey);
        if (date) {
          const user = await getUserByTelegramId(authorId);
          const base: CreatedHomeworkNotification = {
            homeworkId: result.id,
            reason: aiDown ? "ai_down" : "same_false",
            authorId,
            authorDisplay: user ? formatUserDisplay(user) : undefined,
            subject: pending.subject,
            date,
            text: result.text,
          };
          await notifyAdminsNewHomework(
            bot,
            "oldText" in result ? { ...base, oldText: result.oldText } : base
          );
        }
        return;
      }

      await ctx.reply(homeworkSavedMessage(result.action, pending.subject, result.text), {
        reply_markup: daysReplyKeyboard("hwa"),
      });
    } catch (error) {
      console.error("❌ [HOMEWORK] КРИТИЧЕСКАЯ ОШИБКА:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
      await ctx.reply("❌ Произошла ошибка при сохранении ДЗ. Попробуйте ещё раз.");
    }
  });
}
