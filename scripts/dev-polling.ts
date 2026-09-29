#!/usr/bin/env tsx
/**
 * Локальный запуск бота через long polling на Grammy Runner (для разработки)
 * Использование: npm run bot:dev или tsx scripts/dev-polling.ts
 */

import { getBot } from "../src/bot/bot";
import { gracefulShutdown, startRunner } from "../src/bot/runner";

async function main() {
  console.log("🤖 Starting bot in long polling mode (Grammy Runner)...");

  const bot = getBot();

  // Удаляем webhook если был установлен
  try {
    await bot.api.deleteWebhook();
    console.log("✅ Webhook deleted (switching to polling)");
  } catch (error) {
    console.log("⚠️  Could not delete webhook:", error);
  }

  // startRunner() сам вызывает bot.init() перед запуском
  await startRunner();

  const me = bot.botInfo;
  if (!me) throw new Error("bot.init() did not set botInfo");
  console.log(`✅ Bot started: @${me.username}`);
  console.log(`📝 Bot name: ${me.first_name}`);
  console.log(`🔑 Bot ID: ${me.id}`);
  console.log("\n🚀 Bot is running via Grammy Runner. Press Ctrl+C to stop.\n");

  // Graceful shutdown: останавливаем runner и дожидаемся обработки updates
  process.once("SIGINT", () => {
    void gracefulShutdown("SIGINT").then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void gracefulShutdown("SIGTERM").then(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error("❌ Failed to start bot:", error);
  process.exit(1);
});
