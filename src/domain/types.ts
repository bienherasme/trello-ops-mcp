/**
 * Domain-level event model, independent of Trello's field names. Tools map
 * raw TrelloAction payloads into these via the classifiers in listChanges.ts
 * and cardActivity.ts before formatting an MCP response.
 */

export type AuditEventCategory = "structural" | "card_activity";

/**
 * Only the event types verified against real Trello action payloads.
 * list_moved (list reordering) is deliberately absent — its payload shape
 * hasn't been confirmed against live data, so it isn't invented here.
 */
export type AuditEventType =
  | "list_created"
  | "list_renamed"
  | "list_archived"
  | "list_unarchived"
  | "card_created"
  | "card_moved"
  | "card_archived"
  | "card_unarchived";

export interface AuditActor {
  id: string;
  name: string | null;
  username: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: AuditActor;
  category: AuditEventCategory;
  type: AuditEventType;
  boardId: string;
  boardName?: string | undefined;
  entityType: "list" | "card";
  entityId: string;
  entityName?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}
