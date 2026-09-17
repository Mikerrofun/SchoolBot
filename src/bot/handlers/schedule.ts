import type { Bot } from "grammy";
import type { MyContext } from "@/types";
import { showWeeksForFlow } from "./navigation";

// The schedule flow (weeks -> days -> lessons) lives in navigation.ts,
// driven by the reply keyboard. Only the command shortcut remains here.

export function registerScheduleHandlers(bot: Bot<MyContext>) {
  bot.command("расписание", (ctx: MyContext) => showWeeksForFlow(ctx, "sched"));
}
