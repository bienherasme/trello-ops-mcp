import type { TrelloAction } from "../trello/types.js";
import { toActor } from "./actor.js";
import type { AuditEvent } from "./types.js";

/**
 * Classifies a single raw Trello action into a structural list AuditEvent,
 * or null if the action isn't a list structural change we currently model
 * (including updateList sub-variants we don't recognize, e.g. list
 * reordering — see AuditEventType). Pure: no HTTP, no I/O.
 */
export function classifyListAction(action: TrelloAction): AuditEvent | null {
  const boardId = action.data.board?.id;
  if (!boardId) return null;

  const base = {
    id: action.id,
    timestamp: action.date,
    actor: toActor(action.memberCreator),
    category: "structural" as const,
    boardId,
    boardName: action.data.board?.name,
    entityType: "list" as const,
  };

  if (action.type === "createList") {
    const list = action.data.list;
    if (!list?.id) return null;
    return {
      ...base,
      type: "list_created",
      entityId: list.id,
      entityName: list.name,
    };
  }

  if (action.type === "updateList") {
    const list = action.data.list;
    const old = action.data.old;
    if (!list?.id || !old) return null;

    if (old.name !== undefined) {
      return {
        ...base,
        type: "list_renamed",
        entityId: list.id,
        entityName: list.name,
        from: old.name,
        to: list.name,
      };
    }

    if (old.closed !== undefined && list.closed !== undefined) {
      return {
        ...base,
        type: list.closed ? "list_archived" : "list_unarchived",
        entityId: list.id,
        entityName: list.name,
      };
    }

    return null;
  }

  return null;
}

export interface ClassifyListChangesOptions {
  listId?: string | undefined;
}

/**
 * Classifies a batch of raw actions into structural list AuditEvents,
 * dropping anything unrecognized and optionally filtering to a single list.
 */
export function classifyListChanges(
  actions: TrelloAction[],
  options: ClassifyListChangesOptions = {},
): AuditEvent[] {
  const events = actions
    .map(classifyListAction)
    .filter((event): event is AuditEvent => event !== null);

  if (options.listId === undefined) return events;
  return events.filter((event) => event.entityId === options.listId);
}
