import type { TrelloCard } from "../trello/types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A card with no recognized activity within the stale threshold. Neutral
 * naming deliberately avoids "blocked" — Trello data alone can't tell us
 * whether a lack of movement means a card is stuck, waiting on someone
 * else, or simply low priority.
 */
export interface StaleCard {
  cardId: string;
  cardName: string;
  listId: string;
  memberIds: string[];
  /**
   * Exact timestamp of the card's most recent recognized activity, or null
   * when no such activity was found (see `historyComplete` for whether
   * that absence is confirmed or just unknown).
   */
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  /**
   * True when the conclusion for this card is fully reliable: either a
   * real last-activity timestamp was found, or the action scan reached
   * the end of the board's history without ever finding one. False when
   * the scan was truncated (maxActions) before it could confirm either
   * way — the card may or may not have older activity we didn't see.
   */
  historyComplete: boolean;
}

export interface FindStaleCardsOptions {
  listId?: string | undefined;
  memberId?: string | undefined;
}

/**
 * Identifies open cards with no recognized activity within `staleDays`.
 * `lastActivityByCard` should come from getLastActivityByCard over a
 * board's recent actions; `scanWasComplete` reflects whether that action
 * scan was truncated (see TrelloClient.getBoardActions' `truncated` flag)
 * — when it was, a card with no found activity gets `historyComplete:
 * false` rather than being silently asserted as confirmed-stale. Sorted
 * stalest first: cards with no determinable timestamp are surfaced before
 * cards with a known (larger) daysSinceActivity, since an unknown age is
 * at least as worth reviewing as a known old one. `now` is injected for
 * deterministic testing.
 */
export function findStaleCards(
  cards: TrelloCard[],
  lastActivityByCard: Map<string, string>,
  now: Date,
  staleDays: number,
  scanWasComplete: boolean,
  options: FindStaleCardsOptions = {},
): StaleCard[] {
  const nowMs = now.getTime();
  let result: StaleCard[] = [];

  for (const card of cards) {
    if (card.closed) continue;

    const lastActivityAt = lastActivityByCard.get(card.id) ?? null;

    if (lastActivityAt !== null) {
      const daysSinceActivity = Math.floor((nowMs - new Date(lastActivityAt).getTime()) / MS_PER_DAY);
      if (daysSinceActivity < staleDays) continue; // active within the threshold — not stale
      result.push({
        cardId: card.id,
        cardName: card.name,
        listId: card.idList,
        memberIds: card.idMembers,
        lastActivityAt,
        daysSinceActivity,
        historyComplete: true,
      });
    } else {
      result.push({
        cardId: card.id,
        cardName: card.name,
        listId: card.idList,
        memberIds: card.idMembers,
        lastActivityAt: null,
        daysSinceActivity: null,
        historyComplete: scanWasComplete,
      });
    }
  }

  if (options.listId !== undefined) result = result.filter((c) => c.listId === options.listId);
  if (options.memberId !== undefined) {
    result = result.filter((c) => c.memberIds.includes(options.memberId as string));
  }

  return result.sort((a, b) => {
    if (a.daysSinceActivity === null && b.daysSinceActivity === null) return a.cardId.localeCompare(b.cardId);
    if (a.daysSinceActivity === null) return -1;
    if (b.daysSinceActivity === null) return 1;
    if (b.daysSinceActivity !== a.daysSinceActivity) return b.daysSinceActivity - a.daysSinceActivity;
    return a.cardId.localeCompare(b.cardId);
  });
}
