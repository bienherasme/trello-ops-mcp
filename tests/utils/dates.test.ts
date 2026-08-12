import { describe, expect, it } from "vitest";
import { InvalidDateRangeError, resolveDateRange, validateDateRange } from "../../src/utils/dates.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("date range validation and resolution", () => {
  it("accepts valid explicit ranges and resolves the days convenience (including the 7-day default) relative to now", () => {
    expect(() =>
      validateDateRange({ since: "2026-01-01T00:00:00.000Z", before: "2026-01-02T00:00:00.000Z" }),
    ).not.toThrow();

    expect(resolveDateRange({ days: 3 }, NOW)).toEqual({ since: "2026-06-12T12:00:00.000Z", before: undefined });
    expect(resolveDateRange({}, NOW, 7)).toEqual({ since: "2026-06-08T12:00:00.000Z", before: undefined });
    expect(
      resolveDateRange({ since: "2026-01-01T00:00:00.000Z", before: "2026-02-01T00:00:00.000Z" }, NOW),
    ).toEqual({ since: "2026-01-01T00:00:00.000Z", before: "2026-02-01T00:00:00.000Z" });
  });

  it("rejects malformed timestamps, reversed ranges, and ambiguous since/before+days combinations", () => {
    const invalidCalls: Array<() => void> = [
      () => validateDateRange({ since: "not-a-date" }),
      () => validateDateRange({ since: "2026-01-02T00:00:00.000Z", before: "2026-01-01T00:00:00.000Z" }),
      () => validateDateRange({ since: "2026-01-01T00:00:00.000Z", before: "2026-01-01T00:00:00.000Z" }),
      () => resolveDateRange({ since: "2026-01-01T00:00:00.000Z", days: 3 }, NOW),
      () => resolveDateRange({ days: 0 }, NOW),
    ];
    for (const call of invalidCalls) {
      expect(call).toThrow(InvalidDateRangeError);
    }
  });
});
