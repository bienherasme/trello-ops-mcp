import type { CardMovementEvent } from "./cardMovements.js";

/**
 * `cardsMoved` measures Trello workflow activity — how many list-to-list
 * moves an action log attributes to a member — not employee productivity
 * or performance. See README for the full disclaimer.
 */
export interface MemberMovementCount {
  memberId: string;
  memberName: string | null;
  username: string;
  cardsMoved: number;
}

/**
 * Counts movements per member (one movement action = one count, duplicates
 * of the same card by the same person included), sorted descending by
 * cardsMoved. Ties break on memberId ascending so the ordering is
 * deterministic regardless of input order.
 */
export function countMovementsByMember(events: CardMovementEvent[]): MemberMovementCount[] {
  const counts = new Map<string, MemberMovementCount>();

  for (const event of events) {
    const existing = counts.get(event.actor.id);
    if (existing) {
      existing.cardsMoved += 1;
    } else {
      counts.set(event.actor.id, {
        memberId: event.actor.id,
        memberName: event.actor.name,
        username: event.actor.username,
        cardsMoved: 1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => {
    if (b.cardsMoved !== a.cardsMoved) return b.cardsMoved - a.cardsMoved;
    return a.memberId.localeCompare(b.memberId);
  });
}

/**
 * Per-list workflow activity — incoming/outgoing card moves and their net
 * difference. This is workflow activity, not a "productivity" metric.
 */
export interface ListFlow {
  listId: string;
  listName: string | null;
  incomingMoves: number;
  outgoingMoves: number;
  netFlow: number;
}

export function computeListFlow(events: CardMovementEvent[]): ListFlow[] {
  const flow = new Map<string, ListFlow>();

  function ensure(listId: string, listName: string | undefined): ListFlow {
    let entry = flow.get(listId);
    if (!entry) {
      entry = { listId, listName: listName ?? null, incomingMoves: 0, outgoingMoves: 0, netFlow: 0 };
      flow.set(listId, entry);
    } else if (entry.listName === null && listName !== undefined) {
      entry.listName = listName;
    }
    return entry;
  }

  for (const event of events) {
    ensure(event.toList.id, event.toList.name).incomingMoves += 1;
    ensure(event.fromList.id, event.fromList.name).outgoingMoves += 1;
  }

  for (const entry of flow.values()) {
    entry.netFlow = entry.incomingMoves - entry.outgoingMoves;
  }

  return Array.from(flow.values()).sort((a, b) => a.listId.localeCompare(b.listId));
}
