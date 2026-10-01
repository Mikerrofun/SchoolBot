// Константы middleware: TTL для защиты от дублей, стейла и in-flight лока.

/** Макс. возраст апдейта: старше этого — дроп (10 минут). */
export const STALE_TTL_MS = 10 * 60 * 1000;

/** Кэш обработанных update_id живёт 5 минут. */
export const UPDATE_ID_TTL_MS = 5 * 60 * 1000;

/** In-flight лок на чат: 30 секунд максимум. */
export const LOCK_TTL_MS = 30 * 1000;

/** Микро-дедуп навигации: повтор того же текста в пределах 2 секунд — дроп. */
export const NAV_DEDUP_WINDOW_MS = 2 * 1000;
