import type { Bot } from "grammy";
import { checkTextOnTopic } from "@/lib/ai";
import { ERROR_REGISTRY, toBotError } from "@/lib/errors";
import { parseDateKey } from "@/lib/weeks";
import { upsertAdditional } from "@/services/additional.service";
import { getUserByTelegramId } from "@/services/user.service";
import type { MyContext } from "@/types";
import { daysReplyKeyboard } from "../keyboards";
import {
  ADDITIONAL_PENDING_AI_DOWN_TEXT,
  ADDITIONAL_SAVED_TEXT,
  formatUserDisplay,
} from "../messages";
import { notifyAdminsAdditionalReview } from "./admin";

export function registerAdditionalHandlers(bot: Bot<MyContext>) {
  // Free text while an "additional" day is pending -> censor, then save.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending || pending.type !== "additional") return;

    ctx.session.pending = undefined;
    ctx.session.lessonChoices = undefined;

    const date = parseDateKey(pending.dateKey);
    if (!date) return;

    const text = ctx.message.text.trim();

    // Censorship before anything is saved; a rejection creates nothing.
    // When the AI is down the submission is neither lost nor approved
    // blindly: it goes to pending moderation for admins.
    let aiDown = false;
    try {
      const onTopic = await checkTextOnTopic(text);
      if (!onTopic) {
        await ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED, {
          reply_markup: daysReplyKeyboard("ada"),
        });
        return;
      }
    } catch (error) {
      if (toBotError(error).code !== "AI_UNAVAILABLE") throw error;
      aiDown = true;
    }

    const authorId = String(ctx.from?.id ?? "");
    const saved = await upsertAdditional(date, text, authorId, { aiDown });

    if (aiDown) {
      await ctx.reply(ADDITIONAL_PENDING_AI_DOWN_TEXT, {
        reply_markup: daysReplyKeyboard("ada"),
      });
      const user = await getUserByTelegramId(authorId);
      await notifyAdminsAdditionalReview(bot, {
        additionalId: saved.id,
        reason: "ai_down",
        authorId,
        authorDisplay: user ? formatUserDisplay(user) : undefined,
        date,
        text,
      });
      return;
    }

    await ctx.reply(ADDITIONAL_SAVED_TEXT, {
      reply_markup: daysReplyKeyboard("ada"),
    });
  });
}
