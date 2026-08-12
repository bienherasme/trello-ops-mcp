import type { TrelloAction } from "../trello/types.js";
import { toActor } from "./actor.js";
import type { AuditActor } from "./types.js";

/**
 * A confirmed list-to-list card move, independent of Trello's field names.
 * "Confirmed" means the raw action actually carries `old.idList` plus both
 * `listBefore`/`listAfter` — see classifyCardMovement for what's rejected.
 */
export interface CardMovementEvent {
  actionId: string;
  timestamp: string;
  actor: AuditActor;
  boardId: string;
  boardName?: string | undefined;
  card: { id: string; name?: string | undefined };
  fromList: { id: string; name?: string | undefined };
  toList: { id: string; name?: string | undefined };
}

/**
 * Classifies a single raw action as a card movement, or null. A movement
 * counts only when `data.old.idList` is present (the card actually changed
 * lists) and both `listBefore`/`listAfter` are present to name the lists.
 * Same-list reorders, title/due/member-assignment edits, and any other
 * updateCard variant lack `old.idList` and are safely ignored. Pure: no
 * HTTP, no I/O.
 */
export function classifyCardMovement(action: TrelloAction): CardMovementEvent | null {
  if (action.type !== "updateCard") return null;

  const { old, card, listBefore, listAfter, board } = action.data;
  if (old?.idList === undefined) return null;
  if (!card?.id) return null;
  if (!listBefore?.id || !listAfter?.id) return null;
  if (!board?.id) return null;

  return {
    actionId: action.id,
    timestamp: action.date,
    actor: toActor(action.memberCreator),
    boardId: board.id,
    boardName: board.name,
    card: { id: card.id, name: card.name },
    fromList: { id: listBefore.id, name: listBefore.name },
    toList: { id: listAfter.id, name: listAfter.name },
  };
}

export interface ClassifyCardMovementsOptions {
  memberId?: string | undefined;
  cardId?: string | undefined;
  fromListId?: string | undefined;
  toListId?: string | undefined;
}

/**
 * Classifies a batch of raw actions into card movements, optionally
 * filtered by actor, card, source list, or destination list. One movement
 * action counts as one movement: if the same card is moved three times by
 * the same person, that's three separate events here, not deduplicated.
 */
export function classifyCardMovements(
  actions: TrelloAction[],
  options: ClassifyCardMovementsOptions = {},
): CardMovementEvent[] {
  let events = actions
    .map(classifyCardMovement)
    .filter((event): event is CardMovementEvent => event !== null);

  if (options.memberId !== undefined) {
    events = events.filter((event) => event.actor.id === options.memberId);
  }
  if (options.cardId !== undefined) {
    events = events.filter((event) => event.card.id === options.cardId);
  }
  if (options.fromListId !== undefined) {
    events = events.filter((event) => event.fromList.id === options.fromListId);
  }
  if (options.toListId !== undefined) {
    events = events.filter((event) => event.toList.id === options.toListId);
  }

  return events;
}
