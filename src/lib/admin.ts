// Admin allowlist, checked on the server in every approval callback.

/** Telegram user IDs from ADMIN_TELEGRAM_IDS (comma-separated env). */
export function getAdminIds(): number[] {
  return (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => Number(raw))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function isAdmin(
  telegramId: number | string | null | undefined
): boolean {
  if (telegramId === null || telegramId === undefined) return false;
  const id = Number(telegramId);
  return Number.isInteger(id) && getAdminIds().includes(id);
}
