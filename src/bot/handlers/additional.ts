import type { Bot } from "grammy";
import { checkTextOnTopic } from "@/lib/ai";
import { ERROR_REGISTRY } from "@/lib/errors";
import { parseDateKey } from "@/lib/weeks";
import { upsertAdditional } from "@/services/additional.service";
import type { MyContext } from "@/types";
import { daysReplyKeyboard } from "../keyboards";
import { ADDITIONAL_SAVED_TEXT } from "../messages";

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
    // When the AI is unavailable checkTextOnTopic throws AI_UNAVAILABLE —
    // bot.catch answers the user and nothing is saved either.
    const onTopic = await checkTextOnTopic(text);
    if (!onTopic) {
      await ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED, {
        reply_markup: daysReplyKeyboard("ada"),
      });
      return;
    }

    await upsertAdditional(date, text, String(ctx.from?.id ?? ""));
    await ctx.reply(ADDITIONAL_SAVED_TEXT, {
      reply_markup: daysReplyKeyboard("ada"),
    });
  });
}
