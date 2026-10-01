// Дедупликация по update_id: если уже видели и TTL не истёк — дроп.

import type { NextFunction } from "grammy";
import type { MyContext, UpdateIdEntry } from "@/types";
import { UPDATE_ID_TTL_MS } from "./config";

const cache = new Map<number, UpdateIdEntry>();

function cleanExpired(now: number): void {
  for (const [id, entry] of cache.entries()) {
    if (now - entry.timestamp > UPDATE_ID_TTL_MS) {
      cache.delete(id);
    }
  }
}

export async function updateIdDedup(
  ctx: MyContext,
  next: NextFunction
): Promise<void> {
  const updateId = ctx.update.update_id;
  const now = Date.now();

  const existing = cache.get(updateId);
  if (existing && now - existing.timestamp < UPDATE_ID_TTL_MS) {
    console.log(`[updateIdDedup] Дроп: update_id=${updateId} (дубль)`);
    return;
  }

  cache.set(updateId, { timestamp: now });
  cleanExpired(now);

  await next();
}
