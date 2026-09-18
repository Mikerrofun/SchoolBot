// Display-layer subject names. The DB and the schedule template keep the
// official names; only the output (buttons, messages, notices) is shortened.

const SUBJECT_SHORT_NAMES: Record<string, string> = {
  "Физическая культура и здоровье": "Физра",
};

/** Short display name for a subject; unknown subjects pass through as is. */
export function shortSubject(subject: string): string {
  return SUBJECT_SHORT_NAMES[subject] ?? subject;
}
