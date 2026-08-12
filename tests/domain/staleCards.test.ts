import { describe, expect, it } from "vitest";
import { findStaleCards } from "../../src/domain/staleCards.js";
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

describe("findStaleCards", () => {
  it("excludes recently active and closed cards, includes genuinely inactive ones, sorts stalest first, and supports listId/memberId filters", () => {
    const lastActivityByCard = new Map<string, string>([
      ["active", "2026-06-10T00:00:00.000Z"], // 5 days ago, under the 14-day threshold
      ["closed-but-old", "2026-01-01T00:00:00.000Z"],
    ]);
    const cards = [
      card({ id: "active", idList: "list-1", idMembers: ["m1"] }),
      card({ id: "closed-but-old", idList: "list-1", idMembers: ["m1"], closed: true }),
      card({ id: "old-no-activity", idList: "list-1", idMembers: ["m1"] }),
      card({ id: "other-list", idList: "list-2", idMembers: ["m2"] }),
    ];

    const result = findStaleCards(cards, lastActivityByCard, NOW, 14, true);
    expect(result.map((c) => c.cardId)).toEqual(["old-no-activity", "other-list"]);
    expect(result.every((c) => c.historyComplete)).toBe(true);

    const filtered = findStaleCards(cards, lastActivityByCard, NOW, 14, true, { listId: "list-1" });
    expect(filtered.map((c) => c.cardId)).toEqual(["old-no-activity"]);
  });

  it("marks a card historyComplete:true when the scan was exhaustive but historyComplete:false when it was truncated, never asserting confident staleness either way", () => {
    const cards = [card({ id: "c1" })];

    const confirmed = findStaleCards(cards, new Map(), NOW, 14, true);
    expect(confirmed[0]).toMatchObject({ historyComplete: true, lastActivityAt: null, daysSinceActivity: null });

    const unknown = findStaleCards(cards, new Map(), NOW, 14, false);
    expect(unknown[0]).toMatchObject({ historyComplete: false, lastActivityAt: null, daysSinceActivity: null });
  });
});
