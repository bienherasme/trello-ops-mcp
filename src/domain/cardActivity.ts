import type { TrelloAction } from "../trello/types.js";
import { toActor } from "./actor.js";
import { classifyListAction } from "./listChanges.js";
import type { AuditEvent } from "./types.js";

/**
 * Classifies a single raw action into a card AuditEvent (created, moved,
 * archived, unarchived), or null if it's not one of those. Card-move
 * detection mirrors classifyCardMovement's discriminator (`old.idList`
 * present); card archive/unarchive mirrors the list archive pattern
 * (`old.closed` + `card.closed`) — both verified against real Trello
 * API responses rather than assumed from documentation. Pure: no
 * HTTP, no I/O.
 */
export function classifyCardActivity(action: TrelloAction): AuditEvent | null {
  const boardId = action.data.board?.id;
  if (!boardId) return null;

  const base = {
    id: action.id,
    timestamp: action.date,
    actor: toActor(action.memberCreator),
    category: "card_activity" as const,
    boardId,
    boardName: action.data.board?.name,
    entityType: "card" as const,
  };

  if (action.type === "createCard") {
    const card = action.data.card;
    if (!card?.id) return null;
    return {
      ...base,
      type: "card_created",
      entityId: card.id,
      entityName: card.name,
    };
  }

  if (action.type === "updateCard") {
    const old = action.data.old;
    const card = action.data.card;
    if (!old || !card?.id) return null;

    if (old.idList !== undefined) {
      const listBefore = action.data.listBefore;
      const listAfter = action.data.listAfter;
      if (!listBefore?.id || !listAfter?.id) return null;
      return {
        ...base,
        type: "card_moved",
        entityId: card.id,
        entityName: card.name,
        from: listBefore.name,
        to: listAfter.name,
        metadata: { fromListId: listBefore.id, toListId: listAfter.id },
      };
    }

    if (old.closed !== undefined && card.closed !== undefined) {
      return {
        ...base,
        type: card.closed ? "card_archived" : "card_unarchived",
        entityId: card.id,
        entityName: card.name,
      };
    }

    return null;
  }

  return null;
}

/**
 * Combines list-structural and card-activity classification into one
 * chronological (newest-first) feed — the basis for get_member_activity.
 * Callers filter `actions` to a single member (by idMemberCreator) before
 * calling this, since that's cheaper than filtering after classification.
 */
export function classifyMemberActivity(actions: TrelloAction[]): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const action of actions) {
    const listEvent = classifyListAction(action);
    if (listEvent) {
      events.push(listEvent);
      continue;
    }
    const cardEvent = classifyCardActivity(action);
    if (cardEvent) events.push(cardEvent);
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Maps each card to the timestamp of its most recent recognized activity
 * (creation, move, archive/unarchive) among the given actions — the basis
 * for stale-card detection. Deliberately does not treat other updateCard
 * variants (title/desc/due/member edits) as activity, same as
 * classifyCardActivity: only reliably-classified card events count. Pure:
 * no HTTP, no I/O.
 */
export function getLastActivityByCard(actions: TrelloAction[]): Map<string, string> {
  const lastActivity = new Map<string, string>();

  for (const action of actions) {
    const event = classifyCardActivity(action);
    if (!event) continue;

    const existing = lastActivity.get(event.entityId);
    if (!existing || new Date(event.timestamp).getTime() > new Date(existing).getTime()) {
      lastActivity.set(event.entityId, event.timestamp);
    }
  }

  return lastActivity;
}
