// AI helper types (verdicts of the OpenRouter calls in src/lib/ai.ts).

/** Result of comparing incoming homework against the existing one. */
export type ComparisonResult = {
  same: boolean;
  betterText?: string;
};
