/**
 * Centralized ISO 8601 date parsing/validation for any tool or client
 * method that accepts a since/before range. Not reused from a validation
 * library because the requirement is narrow: reject anything that isn't
 * a real, unambiguous ISO 8601 timestamp, and reject inverted ranges.
 */
export class InvalidDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDateRangeError";
  }
}

const ISO_8601_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export function parseIsoDate(input: string, fieldName: string): Date {
  if (!ISO_8601_RE.test(input)) {
    throw new InvalidDateRangeError(
      `${fieldName} must be a valid ISO 8601 timestamp (e.g. 2026-01-01T00:00:00.000Z), got "${input}"`,
    );
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidDateRangeError(`${fieldName} is not a valid date: "${input}"`);
  }
  return date;
}

export interface DateRangeInput {
  since?: string | undefined;
  before?: string | undefined;
}

/**
 * Validates an optional since/before pair: both must be valid ISO 8601
 * timestamps if present, and since must be strictly before `before`.
 */
export function validateDateRange(range: DateRangeInput): void {
  const sinceDate = range.since !== undefined ? parseIsoDate(range.since, "since") : undefined;
  const beforeDate = range.before !== undefined ? parseIsoDate(range.before, "before") : undefined;

  if (sinceDate && beforeDate && sinceDate.getTime() >= beforeDate.getTime()) {
    throw new InvalidDateRangeError(
      `since (${String(range.since)}) must be before before (${String(range.before)})`,
    );
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RangeOrDaysInput {
  since?: string | undefined;
  before?: string | undefined;
  days?: number | undefined;
}

/**
 * Resolves a tool's since/before/days input into a concrete since/before
 * pair. Exactly one of "explicit since/before" or "convenience days" may
 * be used — mixing them is rejected as ambiguous rather than guessing
 * which one wins. With neither supplied, defaults to the last
 * `defaultDays` days. `now` is injected so callers can test deterministically.
 */
export function resolveDateRange(
  input: RangeOrDaysInput,
  now: Date,
  defaultDays = 7,
): DateRangeInput {
  const hasExplicitRange = input.since !== undefined || input.before !== undefined;
  const hasDays = input.days !== undefined;

  if (hasExplicitRange && hasDays) {
    throw new InvalidDateRangeError(
      "Provide either since/before or days, not both — the combination is ambiguous.",
    );
  }

  if (hasDays) {
    const days = input.days as number;
    if (!Number.isFinite(days) || days <= 0) {
      throw new InvalidDateRangeError(`days must be a positive number, got ${days}`);
    }
    return { since: new Date(now.getTime() - days * MS_PER_DAY).toISOString(), before: undefined };
  }

  if (hasExplicitRange) {
    validateDateRange({ since: input.since, before: input.before });
    return { since: input.since, before: input.before };
  }

  return { since: new Date(now.getTime() - defaultDays * MS_PER_DAY).toISOString(), before: undefined };
}
