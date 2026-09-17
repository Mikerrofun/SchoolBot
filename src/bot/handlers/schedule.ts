import type { Bot } from "grammy";
import type { MyContext } from "@/types";
import { startFlow } from "./navigation";

export function registerScheduleHandlers(bot: Bot<MyContext>) {
  bot.command("расписание", (ctx: MyContext) => startFlow(ctx, "sched"));
}
