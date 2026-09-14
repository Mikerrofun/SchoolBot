import { webhookCallback } from "grammy";
import { initBot } from "@/bot/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Vercel free tier limit

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot is not configured", { status: 503 });
  }

  // Проверка secret token
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");
  
  if (!expected || received !== expected) {
    console.error("[webhook] Secret token mismatch:", {
      hasExpected: !!expected,
      hasReceived: !!received,
      match: received === expected
    });
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Инициализируем бота
    const bot = await initBot();
    
    // Используем webhookCallback из grammY
    const handleWebhook = webhookCallback(bot, "std/http");
    
    return await handleWebhook(req);
  } catch (error) {
    console.error("[webhook] error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
