// Display-layer subject names. DB and the schedule template keep the full
// official names; this is the only place where we shorten them for output.

const SUBJECT_SHORT_NAMES: Record<string, string> = {
  "Физическая культура и здоровье": "Физра",
};

/** Short display name for a subject; unknown subjects pass through as is. */
export function displaySubject(subject: string): string {
  return SUBJECT_SHORT_NAMES[subject] ?? subject;
}
