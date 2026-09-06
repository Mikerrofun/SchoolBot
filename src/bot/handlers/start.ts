import type { Bot } from "grammy";
import type { MyContext } from "../bot";
import { mainMenuKeyboard } from "../keyboards";

const MENU_TEXT = `👋 Привет! Это бот класса.

Здесь можно посмотреть расписание и домашнее задание на прошлую, текущую и следующую неделю, а также записать новое ДЗ.

Выбери действие:`;

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
