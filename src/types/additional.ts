// "Additional" (virtual sixth section) domain types.

export type AdditionalEntry = {
  id: number;
  date: Date;
  text: string;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** One row of the week view: text is null when nothing was saved yet. */
export type AdditionalWeekRow = {
  date: Date;
  text: string | null;
};
