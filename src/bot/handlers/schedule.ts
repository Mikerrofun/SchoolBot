import type { Bot } from "grammy";
import type { MyContext } from "@/types";
import { showSchedule } from "./navigation";

export function registerScheduleHandlers(bot: Bot<MyContext>) {
  bot.command("расписание", (ctx: MyContext) => showSchedule(ctx));
}
