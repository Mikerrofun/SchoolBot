// User account types (user storage on /start).

/** Profile fields Telegram gives us on every message. */
export type TelegramUserProfile = {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** Fields needed to render a human-readable author line. */
export type UserDisplayInfo = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};
