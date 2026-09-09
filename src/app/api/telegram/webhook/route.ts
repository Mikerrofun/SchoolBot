import { webhookCallback } from "grammy";
import { getBot } from "@/bot/bot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot is not configured", { status: 503 });
  }

  const handleUpdate = webhookCallback(getBot(), "std/http", {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  });

  return handleUpdate(req);
}

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
