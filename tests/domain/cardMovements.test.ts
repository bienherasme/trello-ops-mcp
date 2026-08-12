import { describe, expect, it } from "vitest";
import { classifyCardMovement } from "../../src/domain/cardMovements.js";
import type { CardMovementEvent } from "../../src/domain/cardMovements.js";
import { computeListFlow, countMovementsByMember } from "../../src/domain/movementAnalytics.js";
import {
  dueDateEditCardAction,
  memberAssignmentCardAction,
  moveCardAction,
  moveCardActionMissingListRefs,
  renameCardAction,
} from "../fixtures/trelloActions.js";

function movement(overrides: Partial<CardMovementEvent> = {}): CardMovementEvent {
  return {
    actionId: `action-${Math.random()}`,
    timestamp: "2026-01-01T00:00:00.000Z",
    actor: { id: "member-a", name: "Ada Lovelace", username: "ada" },
    boardId: "board-1",
    card: { id: "card-1", name: "Card" },
    fromList: { id: "list-a", name: "Backlog" },
    toList: { id: "list-b", name: "In Progress" },
    ...overrides,
  };
}

describe("classifyCardMovement", () => {
  it("classifies a real list-to-list move with actor, card, and from/to list identity", () => {
    expect(classifyCardMovement(moveCardAction)).toEqual({
      actionId: moveCardAction.id,
      timestamp: moveCardAction.date,
      actor: { id: "5f0000000000000000000002", name: "Ada Lovelace", username: "ada" },
      boardId: "5f0000000000000000000001",
      boardName: "Test Board",
      card: { id: "5f0000000000000000000200", name: "Sample Card" },
      fromList: { id: "5f0000000000000000000010", name: "Backlog" },
      toList: { id: "5f0000000000000000000011", name: "In Progress" },
    });
  });

  it("ignores same-list/non-movement updateCard variants (title edit, due edit, member assignment) and moves missing listBefore/listAfter", () => {
    for (const action of [renameCardAction, dueDateEditCardAction, memberAssignmentCardAction, moveCardActionMissingListRefs]) {
      expect(classifyCardMovement(action)).toBeNull();
    }
  });
});

describe("movement analytics", () => {
  it("counts multiple movement events per member (duplicates included, not deduplicated by card) and sorts descending", () => {
    const events = [
      movement({ actor: { id: "member-a", name: "Ada", username: "ada" }, card: { id: "c1" } }),
      movement({ actor: { id: "member-a", name: "Ada", username: "ada" }, card: { id: "c1" } }), // same card again
      movement({ actor: { id: "member-b", name: "Grace", username: "grace" } }),
      movement({ actor: { id: "member-b", name: "Grace", username: "grace" } }),
      movement({ actor: { id: "member-b", name: "Grace", username: "grace" } }),
    ];
    const counts = countMovementsByMember(events);
    expect(counts).toEqual([
      { memberId: "member-b", memberName: "Grace", username: "grace", cardsMoved: 3 },
      { memberId: "member-a", memberName: "Ada", username: "ada", cardsMoved: 2 },
    ]);
  });

  it("breaks ranking ties deterministically by memberId, regardless of input order", () => {
    const events = [
      movement({ actor: { id: "member-z", name: "Zara", username: "zara" } }),
      movement({ actor: { id: "member-a", name: "Ada", username: "ada" } }),
      movement({ actor: { id: "member-m", name: "Mona", username: "mona" } }),
    ];
    expect(countMovementsByMember(events).map((c) => c.memberId)).toEqual(["member-a", "member-m", "member-z"]);
  });

  it("computes per-list incoming/outgoing/net flow", () => {
    const events = [
      movement({ fromList: { id: "list-a" }, toList: { id: "list-b" } }),
      movement({ fromList: { id: "list-a" }, toList: { id: "list-b" } }),
      movement({ fromList: { id: "list-b" }, toList: { id: "list-c" } }),
    ];
    const flow = computeListFlow(events);
    expect(flow.find((f) => f.listId === "list-a")).toMatchObject({ incomingMoves: 0, outgoingMoves: 2, netFlow: -2 });
    expect(flow.find((f) => f.listId === "list-b")).toMatchObject({ incomingMoves: 2, outgoingMoves: 1, netFlow: 1 });
    expect(flow.find((f) => f.listId === "list-c")).toMatchObject({ incomingMoves: 1, outgoingMoves: 0, netFlow: 1 });
  });
});
