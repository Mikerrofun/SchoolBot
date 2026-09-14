import { webhookCallback } from "grammy";
import { getBot } from "@/bot/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Vercel free tier limit

// Проверка secret token перед обработкой
async function verifySecretToken(req: Request): Promise<boolean> {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");
  return !!expected && received === expected;
}

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot is not configured", { status: 503 });
  }

  // Проверка secret token
  if (!(await verifySecretToken(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Используем webhookCallback из grammY для правильной обработки
  const bot = getBot();
  const handleWebhook = webhookCallback(bot, "std/http");
  
  try {
    return await handleWebhook(req);
  } catch (error) {
    console.error("[webhook] error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
