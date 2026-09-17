import type { Bot } from "grammy";
import { logError } from "@/lib/errors";
import { upsertUser } from "@/services/user.service";
import type { MyContext } from "@/types";
import { mainMenuReply } from "../keyboards";
import { MENU_TEXT } from "../messages";

export async function showMainMenu(ctx: MyContext) {
  // Entering the menu resets the reply-navigation state.
  ctx.session.nav = undefined;
  return ctx.reply(MENU_TEXT, { reply_markup: mainMenuReply() });
}

export function registerStartHandler(bot: Bot<MyContext>) {
  bot.command("start", async (ctx) => {
    // Users are recorded only on /start; a repeated /start refreshes
    // username and name. A storage failure must not block the menu.
    if (ctx.from) {
      try {
        await upsertUser(ctx.from);
      } catch (error) {
        logError("start", error);
      }
    }
    await showMainMenu(ctx);
  });

  bot.command("menu", (ctx) => showMainMenu(ctx));
}
