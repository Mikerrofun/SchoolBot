import { prisma } from "@/lib/prisma";

/** Minimal shape of a Telegram `from` user we care about. */
export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

/**
 * Creates the user record or refreshes username / name on a repeated call.
 * Called only from /start — there is no per-message check by design.
 */
export async function upsertUser(user: TelegramUser) {
  const telegramId = String(user.id);
  const data = {
    username: user.username ?? null,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
  };

  return prisma.user.upsert({
    where: { telegramId },
    update: data,
    create: { telegramId, ...data },
  });
}

/** Looks a user up by Telegram id; null when the user never did /start. */
export async function getUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({ where: { telegramId } });
}

/** "Имя Фамилия" from a stored user, or null when nothing is stored. */
export function userDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
}): string | null {
  const name = [user.firstName, user.lastName]
    .filter((part) => part && part.length > 0)
    .join(" ");
  return name.length > 0 ? name : null;
}
