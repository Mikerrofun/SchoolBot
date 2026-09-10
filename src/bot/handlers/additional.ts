import type { Bot } from "grammy";
import type { MyContext } from "../bot";
import { getWeekWindow, parseDateKey, weekDates } from "@/lib/weeks";
import type { WeekOffset } from "@/types";
import { getAdditionalForWeek, upsertAdditional } from "@/services/additional.service";
import { simpleDayKeyboard, weekKeyboard } from "../keyboards";
import {
  ADDITIONAL_ADD_PICK_TEXT,
  ADDITIONAL_SAVED_TEXT,
  ADDITIONAL_VIEW_PICK_TEXT,
  additionalInputPrompt,
  additionalWeekMessage,
} from "../messages";

export function registerAdditionalHandlers(bot: Bot<MyContext>) {
  // ── View: week -> one message with all five days ─────────────────────────

  bot.callbackQuery("adv:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADDITIONAL_VIEW_PICK_TEXT, {
      reply_markup: weekKeyboard("adv"),
    });
  });

  bot.callbackQuery(/^adv:w:(-1|0|1)$/, showAdditionalWeek);
  // "Дополнительно" shortcut from the homework view day picker.
  bot.callbackQuery(/^hwv:extra:(-1|0|1)$/, showAdditionalWeek);

  // ── Edit: week -> day -> free text, saved immediately ────────────────────

  bot.callbackQuery("ada:pick", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ADDITIONAL_ADD_PICK_TEXT, {
      reply_markup: weekKeyboard("ada"),
    });
  });

  bot.callbackQuery(/^ada:w:(-1|0|1)$/, showAdditionalDays);
  // "Дополнительно" shortcut from the homework add day picker.
  bot.callbackQuery(/^hwa:extra:(-1|0|1)$/, showAdditionalDays);

  bot.callbackQuery(/^ada:d:(-1|0|1):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, , dayDateKey] = ctx.match!;
    const date = parseDateKey(dayDateKey);
    if (!date) return;

    ctx.session.pending = { type: "additional", dateKey: dayDateKey };
    await ctx.reply(additionalInputPrompt(date));
  });

  // Free text while an "additional" day is pending -> save immediately.
  bot.on("message:text", async (ctx) => {
    const pending = ctx.session.pending;
    if (!pending || pending.type !== "additional") return;

    ctx.session.pending = undefined;

    const date = parseDateKey(pending.dateKey);
    if (!date) return;

    await upsertAdditional(date, ctx.message.text.trim(), String(ctx.from?.id ?? ""));
    await ctx.reply(ADDITIONAL_SAVED_TEXT);
  });
}

async function showAdditionalWeek(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  const offset = Number((ctx.match as RegExpMatchArray)[1]) as WeekOffset;
  const rows = await getAdditionalForWeek(getWeekWindow(offset));
  await ctx.editMessageText(additionalWeekMessage(offset, rows), {
    reply_markup: weekKeyboard("adv"),
  });
}

async function showAdditionalDays(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  const offset = Number((ctx.match as RegExpMatchArray)[1]) as WeekOffset;
  await ctx.editMessageText(ADDITIONAL_ADD_PICK_TEXT, {
    reply_markup: simpleDayKeyboard("ada", offset, weekDates(offset)),
  });
}
