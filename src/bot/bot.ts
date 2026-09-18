import { Bot, session } from "grammy";
import { toBotError } from "@/lib/errors";
import type { MyContext, SessionData } from "@/types";
import { registerAdminHandlers } from "./handlers/admin";
import { registerAdditionalHandlers } from "./handlers/additional";
import { registerHomeworkHandlers } from "./handlers/homework";
import { registerNavigationHandlers } from "./handlers/navigation";
import { registerScheduleHandlers } from "./handlers/schedule";
import { registerStartHandler } from "./handlers/start";

let cachedBot: Bot<MyContext> | null = null;

export function getBot(): Bot<MyContext> {
  if (cachedBot) return cachedBot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const bot = new Bot<MyContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  // The reply-keyboard text router runs first: navigation presses cancel any
  // pending free-text input before the flow handlers see the message.
  console.log("🔧 [INIT] Регистрация handlers...");
  registerStartHandler(bot);
  registerNavigationHandlers(bot);
  registerScheduleHandlers(bot);
  console.log("🔧 [INIT] Вызываем registerHomeworkHandlers...");
  registerHomeworkHandlers(bot);
  console.log("🔧 [INIT] registerHomeworkHandlers завершён");
  registerAdditionalHandlers(bot);
  registerAdminHandlers(bot);
  console.log("🔧 [INIT] Все handlers зарегистрированы");

  bot.catch(async (err) => {
    const botError = toBotError(err.error);
    console.error(`[v0] bot error ${botError.code}:`, err.error);
    // Tell the user something went wrong; never rethrow — the webhook
    // route already answers 200 to Telegram.
    try {
      await err.ctx.reply(botError.message);
    } catch {
      // Sending the error message failed too — nothing else to do.
    }
  });

  cachedBot = bot;
  return bot;
}

// Инициализация бота для serverless окружения
let botInitPromise: Promise<void> | null = null;

export async function initBot(): Promise<Bot<MyContext>> {
  const bot = getBot();

  if (!botInitPromise) {
    botInitPromise = bot.init().catch((error) => {
      // Don't cache the failure: the next update must be able to retry init
      // (e.g. a transient network error right after a cold start).
      botInitPromise = null;
      throw error;
    });
  }

  await botInitPromise;
  return bot;
}
