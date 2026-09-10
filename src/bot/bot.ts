import { Bot, session, type Context, type SessionFlavor } from "grammy";
import { registerAdminHandlers } from "./handlers/admin";
import { registerAdditionalHandlers } from "./handlers/additional";
import { registerHomeworkHandlers } from "./handlers/homework";
import { registerScheduleHandlers } from "./handlers/schedule";
import { registerStartHandler } from "./handlers/start";
import { BOT_ERROR_TEXT } from "./messages";

export type PendingInput =
  | { type: "lesson"; lessonId: number; subject: string; dateKey: string }
  | { type: "additional"; dateKey: string };

export type SessionData = {
  /** What the user is currently typing free text for. */
  pending?: PendingInput;
};

export type MyContext = Context & SessionFlavor<SessionData>;

let cachedBot: Bot<MyContext> | null = null;

export function getBot(): Bot<MyContext> {
  if (cachedBot) return cachedBot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const bot = new Bot<MyContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  // Commands and callback flows first, free-text input last.
  registerStartHandler(bot);
  registerScheduleHandlers(bot);
  registerHomeworkHandlers(bot);
  registerAdditionalHandlers(bot);
  registerAdminHandlers(bot);

  bot.catch(async (err) => {
    console.error("[v0] bot error:", err.error);
    // Tell the user something went wrong; never rethrow — the webhook
    // route already answers 200 to Telegram.
    try {
      await err.ctx.reply(BOT_ERROR_TEXT);
    } catch {
      // Sending the error message failed too — nothing else to do.
    }
  });

  cachedBot = bot;
  return bot;
}
