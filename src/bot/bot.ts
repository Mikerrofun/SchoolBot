import { Bot, session } from "grammy";
import { toBotError } from "@/lib/errors";
import type { MyContext, SessionData } from "@/types";
import { staleUpdates } from "./middleware/staleUpdates";
import { updateIdDedup } from "./middleware/updateIdDedup";
import { inFlightGuard } from "./middleware/inFlightGuard";
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

  bot.api.config.use((prev, method, payload, signal) => {
    if (method === "getUpdates") {
      return prev(
        method,
        {
          ...payload,
          allowed_updates: ["message", "callback_query"],
        },
        signal,
      );
    }
    return prev(method, payload, signal);
  });

  // Middleware защиты: stale → update_id dedup → in-flight guard → session → handlers
  bot.use(staleUpdates);
  bot.use(updateIdDedup);
  bot.use(inFlightGuard);
  bot.use(session({ initial: (): SessionData => ({}) }));

  // Первым срабатывает маршрутизатор текста с клавиатуры ответов: нажатия, связанные с навигацией,
  // отменяют любой ожидающий ввода произвольный текст до того, как сообщение попадет к обработчикам сценария.
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
      botInitPromise = null;
      throw error;
    });
  }

  await botInitPromise;
  return bot;
}
