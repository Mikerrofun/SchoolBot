// Фильтрует устаревшие апдейты: если message.date старше STALE_TTL_MS, дроп.

import type { NextFunction } from "grammy";
import type { MyContext } from "@/types";
import { STALE_TTL_MS } from "./config";

export async function staleUpdates(
  ctx: MyContext,
  next: NextFunction
): Promise<void> {
  const update = ctx.update;
  const now = Date.now();

  // Дата апдейта в unix-секундах
  let updateDate: number | undefined;

  if ("message" in update && update.message) {
    updateDate = update.message.date;
  } else if ("callback_query" in update && update.callback_query?.message) {
    updateDate = update.callback_query.message.date;
  }

  if (updateDate) {
    const ageMs = now - updateDate * 1000;
    if (ageMs > STALE_TTL_MS) {
      const chatId = ctx.chat?.id;
      console.log(
        `[staleUpdates] Дроп: chatId=${chatId}, возраст=${Math.floor(ageMs / 1000)}с`
      );
      return; // Не вызываем next()
    }
  }

  await next();
}
