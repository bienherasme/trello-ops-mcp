import type { TrelloCard } from "../trello/types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `daysOverdue`/`daysUntilDue` are exact elapsed 24-hour periods from the
 * injected `now`, not calendar-day boundaries — deliberately, since this
 * project doesn't do timezone-aware calendar math. A card due 25 hours ago
 * is 1 day overdue; one due 1 hour ago is 0 days overdue (but still
 * overdue, since overdue only requires due < now).
 */

export interface OverdueCard {
  cardId: string;
  cardName: string;
  listId: string;
  due: string;
  daysOverdue: number;
  memberIds: string[];
}

export interface UpcomingCard {
  cardId: string;
  cardName: string;
  listId: string;
  due: string;
  daysUntilDue: number;
  memberIds: string[];
}

export interface DueCardFilterOptions {
  listId?: string | undefined;
  memberId?: string | undefined;
}

/**
 * A card is overdue when: due is set, dueComplete is false, the card isn't
 * closed, and due is strictly before `now`. Sorted most-overdue first
 * (earliest due date first). Pure — `now` is injected so tests can use a
 * fixed clock instead of the real wall clock.
 */
export function findOverdueCards(
  cards: TrelloCard[],
  now: Date,
  options: DueCardFilterOptions = {},
): OverdueCard[] {
  const nowMs = now.getTime();

  let result = cards
    .filter((card) => card.due !== null && !card.dueComplete && !card.closed)
    .map((card) => ({ card, dueMs: new Date(card.due as string).getTime() }))
    .filter(({ dueMs }) => dueMs < nowMs)
    .map(({ card, dueMs }) => ({
      cardId: card.id,
      cardName: card.name,
      listId: card.idList,
      due: card.due as string,
      daysOverdue: Math.floor((nowMs - dueMs) / MS_PER_DAY),
      memberIds: card.idMembers,
    }));

  if (options.listId !== undefined) result = result.filter((c) => c.listId === options.listId);
  if (options.memberId !== undefined) {
    result = result.filter((c) => c.memberIds.includes(options.memberId as string));
  }

  return result.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

/**
 * A card is upcoming when: due is set, dueComplete is false, the card
 * isn't closed, due is at-or-after `now`, and due falls within
 * `withinDays` from `now`. A card due exactly at `now` counts as upcoming
 * (daysUntilDue: 0), not overdue — overdue requires due strictly before
 * now. Sorted soonest-due first.
 */
export function findUpcomingCards(
  cards: TrelloCard[],
  now: Date,
  withinDays: number,
  options: DueCardFilterOptions = {},
): UpcomingCard[] {
  const nowMs = now.getTime();
  const windowEndMs = nowMs + withinDays * MS_PER_DAY;

  let result = cards
    .filter((card) => card.due !== null && !card.dueComplete && !card.closed)
    .map((card) => ({ card, dueMs: new Date(card.due as string).getTime() }))
    .filter(({ dueMs }) => dueMs >= nowMs && dueMs <= windowEndMs)
    .map(({ card, dueMs }) => ({
      cardId: card.id,
      cardName: card.name,
      listId: card.idList,
      due: card.due as string,
      daysUntilDue: Math.ceil((dueMs - nowMs) / MS_PER_DAY),
      memberIds: card.idMembers,
    }));

  if (options.listId !== undefined) result = result.filter((c) => c.listId === options.listId);
  if (options.memberId !== undefined) {
    result = result.filter((c) => c.memberIds.includes(options.memberId as string));
  }

  return result.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}
