// Grammy Runner: масштабируемый long polling для режима polling.
// В webhook-режиме (Vercel) runner не используется — там обновления
// приходят через bot.handleUpdate в src/app/api/telegram/webhook/route.ts.

import { run, type RunnerHandle } from "@grammyjs/runner";

import { initBot } from "./bot";

/**
 * Храним runner instance, чтобы graceful shutdown мог его остановить
 * из любого места (обработчики сигналов, тесты, внешние скрипты).
 */
let runnerInstance: RunnerHandle | null = null;

export function getRunner(): RunnerHandle | null {
  return runnerInstance;
}

/**
 * Инициализирует бота (bot.init) и запускает runner.
 * Идемпотентна: повторный вызов возвращает уже запущенный runner.
 */
export async function startRunner(): Promise<RunnerHandle> {
  if (runnerInstance) return runnerInstance;

  const bot = await initBot();
  const runner = run(bot);

  runnerInstance = runner;
  console.log("🏃 [RUNNER] Grammy Runner запущен");

  return runner;
}

/**
 * Плавная остановка: runner перестаёт забирать новые updates
 * (прерывая pending getUpdates через AbortSignal) и дожидается
 * завершения всех уже начатых обработчиков.
 */
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
