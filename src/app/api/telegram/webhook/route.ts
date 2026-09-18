import { initBot } from "@/bot/bot";
import { ERROR_REGISTRY, toBotError } from "@/lib/errors";
import type {
  ErrorCode,
  WebhookErrorPayload,
  WebhookSuccessPayload,
} from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Vercel free tier limit

function errorResponse(code: ErrorCode, status = 200): Response {
  const body: WebhookErrorPayload = {
    ok: false,
    error: { code, message: ERROR_REGISTRY[code] },
  };
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return errorResponse("BOT_NOT_CONFIGURED");
  }

  // Проверка secret token
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");

  if (!expected || received !== expected) {
    console.error("[webhook] Secret token mismatch");
    return errorResponse("UNAUTHORIZED", 401);
  }

  try {
    const bot = await initBot();
    const update = await req.json();
    await bot.handleUpdate(update);

    const body: WebhookSuccessPayload = { ok: true };
    return Response.json(body);
  } catch (error) {
    // Always HTTP 200: Telegram must not retry and duplicate the update.
    // The structured body carries the registry code + user-friendly message.
    const botError = toBotError(error);
    console.error(`[webhook] error ${botError.code}:`, error);
    return errorResponse(botError.code);
  }
}

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
