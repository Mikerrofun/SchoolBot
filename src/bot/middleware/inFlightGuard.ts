// In-flight guard: один запрос на чат; allowlist + микро-дедуп для навигации.

import type { NextFunction } from "grammy";
import type { MyContext, ChatLock, NavDedupEntry } from "@/types";
import { LOCK_TTL_MS, NAV_DEDUP_WINDOW_MS } from "./config";
import { NAV_ALLOWLIST } from "./allowlist";

const locks = new Map<number, ChatLock>();
const navDedup = new Map<string, NavDedupEntry>();

function cleanNavDedup(now: number): void {
  for (const [key, entry] of navDedup.entries()) {
    if (now - entry.timestamp > NAV_DEDUP_WINDOW_MS) {
      navDedup.delete(key);
    }
  }
}

export async function inFlightGuard(
  ctx: MyContext,
  next: NextFunction
): Promise<void> {
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  if (!chatId) {
    await next();
    return;
  }

  const now = Date.now();
  const text = ctx.message?.text;

  // 1. Навигация из allowlist → обрабатываем БЕЗ лока (всегда)
  if (text && NAV_ALLOWLIST.has(text)) {
    const dedupKey = `${chatId}:${text}`;
    const lastNav = navDedup.get(dedupKey);

    if (lastNav && now - lastNav.timestamp < NAV_DEDUP_WINDOW_MS) {
      console.log(
        `[inFlightGuard] Дроп: chatId=${chatId}, дубль навигации "${text}"`
      );
      return;
    }

    navDedup.set(dedupKey, { timestamp: now });
    cleanNavDedup(now);
    await next();
    return;
  }

  const lock = locks.get(chatId);

  if (lock && now - lock.since < LOCK_TTL_MS) {
    console.log(`[inFlightGuard] Дроп: chatId=${chatId}, лок активен`);
    return;
  }

  locks.set(chatId, { since: now });

  try {
    await next();
  } finally {
    locks.delete(chatId);
  }
}
