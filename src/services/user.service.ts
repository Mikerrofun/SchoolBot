import { prisma } from "@/lib/prisma";
import type { TelegramUserProfile } from "@/types";

/**
 * User storage: upserted on /start only — no per-message checks.
 * A repeated /start refreshes username/nickname.
 */
export async function upsertUserFromTelegram(profile: TelegramUserProfile) {
  const { telegramId, username, firstName, lastName } = profile;
  return prisma.user.upsert({
    where: { telegramId },
    update: { username, firstName, lastName },
    create: { telegramId, username, firstName, lastName },
  });
}

/** Null when the user never did /start (e.g. records from before the feature). */
export async function getUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({ where: { telegramId } });
}
