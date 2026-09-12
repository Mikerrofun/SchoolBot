import type { Bot } from "grammy";
import type { MyContext } from "@/types";
import { mainMenuKeyboard } from "../keyboards";
import { MENU_TEXT } from "../messages";

export function showMainMenu(ctx: MyContext) {
  return ctx.reply(MENU_TEXT, { reply_markup: mainMenuKeyboard() });
}

export function registerStartHandler(bot: Bot<MyContext>) {
  bot.command("start", (ctx) => showMainMenu(ctx));
  bot.command("menu", (ctx) => showMainMenu(ctx));

  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(MENU_TEXT, { reply_markup: mainMenuKeyboard() });
  });
}
