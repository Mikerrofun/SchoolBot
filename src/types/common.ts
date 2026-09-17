// Shared primitives used across the whole app.

export type WeekOffset = -1 | 0 | 1;

export type DayKey =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** The -1/0/1 week window, always computed on the fly from concrete dates. */
export type WeekWindow = {
  /** Monday 00:00:00.000 of the week. */
  start: Date;
  /** Sunday 23:59:59.999 of the week. */
  end: Date;
  offset: WeekOffset;
};
