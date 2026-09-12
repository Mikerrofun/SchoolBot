import type { Update } from "grammy/types";
import { getBot } from "@/bot/bot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot is not configured", { status: 503 });
  }

  // Secret-token check: Telegram sends it with every webhook request
  // (set via `secret_token` in setWebhook). Missing env or header mismatch
  // is rejected before the update is processed at all.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || received !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Always answer 200 so Telegram does not retry the update endlessly;
  // handler-level errors are reported to the user from bot.catch.
  try {
    await getBot().handleUpdate(update);
  } catch (error) {
    console.error("[v0] webhook update failed:", {
      updateType: Object.keys(update)[0],
      chatId:
        "message" in update && update.message
          ? update.message.chat.id
          : "callback_query" in update && update.callback_query
            ? update.callback_query.message?.chat.id
            : undefined,
      error,
    });
  }

  return new Response("OK", { status: 200 });
}

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
