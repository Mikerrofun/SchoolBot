import type { Bot } from "grammy";
import { upsertUserFromTelegram } from "@/services/user.service";
import type { MyContext } from "@/types";
import { showMainMenu } from "./navigation";

export function registerStartHandler(bot: Bot<MyContext>) {
  bot.command("start", async (ctx) => {
    if (ctx.from) {
      // User storage: upsert on /start only; a repeated /start refreshes
      // username/nickname. Failures propagate to the unified error handler.
      await upsertUserFromTelegram({
        telegramId: String(ctx.from.id),
        username: ctx.from.username ?? null,
        firstName: ctx.from.first_name ?? null,
        lastName: ctx.from.last_name ?? null,
      });
    }
    await showMainMenu(ctx);
  });

  bot.command("menu", (ctx) => showMainMenu(ctx));

  // The inline « Меню button (lesson picker) — navigation itself is reply now.
  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMainMenu(ctx);
  });
}
