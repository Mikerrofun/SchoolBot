#!/usr/bin/env tsx
/**
 * Локальный запуск бота через long polling (для разработки)
 * Использование: npm run bot:dev или tsx scripts/dev-polling.ts
 */

import { getBot } from "../src/bot/bot";

async function main() {
  console.log("🤖 Starting bot in long polling mode...");
  
  const bot = getBot();

  // Удаляем webhook если был установлен
  try {
    await bot.api.deleteWebhook();
    console.log("✅ Webhook deleted (switching to polling)");
  } catch (error) {
    console.log("⚠️  Could not delete webhook:", error);
  }

  // Информация о боте
  const me = await bot.api.getMe();
  console.log(`✅ Bot started: @${me.username}`);
  console.log(`📝 Bot name: ${me.first_name}`);
  console.log(`🔑 Bot ID: ${me.id}`);
  console.log("\n🚀 Bot is running in polling mode. Press Ctrl+C to stop.\n");

  // Запуск long polling
  await bot.start({
    onStart: (botInfo) => {
      console.log(`👂 Listening for updates...`);
    },
  });
}

main().catch((error) => {
  console.error("❌ Failed to start bot:", error);
  process.exit(1);
});
