// Grammy Runner: масштабируемый long polling для режима polling.
// В webhook-режиме (Vercel) runner не используется — там обновления
// приходят через bot.handleUpdate в src/app/api/telegram/webhook/route.ts.

import { run, type RunnerHandle } from "@grammyjs/runner";

import { initBot } from "./bot";

let runnerInstance: RunnerHandle | null = null;

export function getRunner(): RunnerHandle | null {
  return runnerInstance;
}

export async function startRunner(): Promise<RunnerHandle> {
  if (runnerInstance) return runnerInstance;

  const bot = await initBot();
  const runner = run(bot, { sink: { concurrency: 20 } });

  runnerInstance = runner;
  console.log("🏃 [RUNNER] Grammy Runner запущен (concurrency: 20)");

  return runner;
}

export async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`🛑 [SHUTDOWN] Получен сигнал ${signal}, останавливаем runner...`);

  const runner = getRunner();
  if (!runner) {
    console.log("ℹ️  [SHUTDOWN] Runner не был запущен");
    return;
  }

  if (!runner.isRunning()) {
    console.log("ℹ️  [SHUTDOWN] Runner уже остановлен");
    return;
  }

  await runner.stop();
  console.log("✅ [SHUTDOWN] Runner остановлен, все обновления обработаны");
}
