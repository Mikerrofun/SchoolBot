// Sets the Telegram webhook for the bot.
//
// Usage:
//   pnpm bot:set-webhook https://your-app.vercel.app
// or set VERCEL_URL / TELEGRAM_WEBHOOK_URL and run without arguments.

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    process.exit(1);
  }

  const url =
    process.argv[2] ??
    process.env.TELEGRAM_WEBHOOK_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!url) {
    console.error("Pass the deployment URL: pnpm bot:set-webhook https://...");
    process.exit(1);
  }

  const webhookUrl = `${url.replace(/\/$/, "")}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
      }),
    }
  );

  const result = await response.json();
  console.log(`Webhook ${webhookUrl}:`, JSON.stringify(result));
  if (!result.ok) process.exit(1);
}

main();
