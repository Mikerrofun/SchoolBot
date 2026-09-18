import type { Bot } from "grammy";
import { censorSubmission } from "../censorship";
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
    // "moderation" means the AI is down: the submission is neither lost
    // nor published unchecked — it goes to pending moderation for admins.
    const verdict = await censorSubmission(ctx, text, "ada");
    if (verdict.outcome === "rejected") return;

    const aiDown = verdict.outcome === "moderation";
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
