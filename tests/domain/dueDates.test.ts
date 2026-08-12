import { describe, expect, it } from "vitest";
import { findOverdueCards, findUpcomingCards } from "../../src/domain/dueDates.js";
import type { TrelloCard } from "../../src/trello/types.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function card(overrides: Partial<TrelloCard> = {}): TrelloCard {
  return {
    id: `card-${Math.random()}`,
    name: "Card",
    idList: "list-1",
    idMembers: [],
    due: null,
    dueComplete: false,
    closed: false,
    url: "https://trello.com/c/abc",
    ...overrides,
  };
}

describe("findOverdueCards", () => {
  it("flags an incomplete open card with a past due date, computing daysOverdue as exact elapsed 24h periods", () => {
    const result = findOverdueCards(
      [
        card({ id: "c1", due: "2026-06-14T12:00:00.000Z" }), // 24h ago -> 1 day
        card({ id: "c2", due: "2026-06-15T11:00:00.000Z" }), // 1h ago -> 0 days, still overdue
      ],
      NOW,
    );
    expect(result.map((c) => [c.cardId, c.daysOverdue])).toEqual([
      ["c1", 1],
      ["c2", 0],
    ]);
  });

  it("excludes completed, closed, and null-due cards, and a card due exactly at now", () => {
    const result = findOverdueCards(
      [
        card({ due: "2026-06-01T00:00:00.000Z", dueComplete: true }),
        card({ due: "2026-06-01T00:00:00.000Z", closed: true }),
        card({ due: null }),
        card({ due: NOW.toISOString() }), // overdue requires strictly before now
      ],
      NOW,
    );
    expect(result).toEqual([]);
  });
});

describe("findUpcomingCards", () => {
  it("includes a card due within the window, treating due-exactly-at-now as upcoming (daysUntilDue: 0)", () => {
    const result = findUpcomingCards(
      [card({ id: "soon", due: "2026-06-17T12:00:00.000Z" }), card({ id: "now", due: NOW.toISOString() })],
      NOW,
      7,
    );
    expect(result.map((c) => [c.cardId, c.daysUntilDue])).toEqual([
      ["now", 0],
      ["soon", 2],
    ]);
  });

  it("excludes a card due before now (that's overdue, not upcoming) or after the window", () => {
    const result = findUpcomingCards(
      [card({ due: "2026-06-15T00:00:00.000Z" }), card({ due: "2026-06-25T00:00:00.000Z" })],
      NOW,
      7,
    );
    expect(result).toEqual([]);
  });
});

describe("sorting and filtering", () => {
  it("sorts overdue most-first and upcoming soonest-first, and both support listId/memberId filtering", () => {
    const overdue = findOverdueCards(
      [
        card({ id: "recent", idList: "list-1", idMembers: ["m1"], due: "2026-06-15T00:00:00.000Z" }),
        card({ id: "oldest", idList: "list-1", idMembers: ["m1"], due: "2026-06-01T00:00:00.000Z" }),
        card({ id: "other-list", idList: "list-2", idMembers: ["m1"], due: "2026-06-05T00:00:00.000Z" }),
      ],
      NOW,
      { listId: "list-1" },
    );
    expect(overdue.map((c) => c.cardId)).toEqual(["oldest", "recent"]);

    const upcoming = findUpcomingCards(
      [
        card({ id: "mine", idMembers: ["m1"], due: "2026-06-16T00:00:00.000Z" }),
        card({ id: "someone-elses", idMembers: ["m2"], due: "2026-06-16T00:00:00.000Z" }),
      ],
      NOW,
      7,
      { memberId: "m1" },
    );
    expect(upcoming.map((c) => c.cardId)).toEqual(["mine"]);
  });
});
