import { Bot, session, type Context, type SessionFlavor } from "grammy";
import { registerHomeworkHandlers } from "./handlers/homework";
import { registerScheduleHandlers } from "./handlers/schedule";
import { registerStartHandler } from "./handlers/start";

export type SessionData = {
  /** Lesson the user is currently typing homework for. */
  pending?: { lessonId: number; subject: string; dateKey: string };
};

export type MyContext = Context & SessionFlavor<SessionData>;

let cachedBot: Bot<MyContext> | null = null;

export function getBot(): Bot<MyContext> {
  if (cachedBot) return cachedBot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const bot = new Bot<MyContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  // Commands and callback flows first, free-text homework input last.
  registerStartHandler(bot);
  registerScheduleHandlers(bot);
  registerHomeworkHandlers(bot);

  bot.catch((err) => {
    console.error("[v0] bot error:", err.error);
  });

  cachedBot = bot;
  return bot;
}
