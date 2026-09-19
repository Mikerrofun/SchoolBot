import type { Bot } from "grammy";
import { upsertUserFromTelegram } from "@/services/user.service";
import type { MyContext } from "@/types";
import { START_TEXT } from "../messages";
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
    // Send welcome message first
    await ctx.reply(START_TEXT);
    // Then show main menu keyboard (resets session state)
    await showMainMenu(ctx);
  });
}
