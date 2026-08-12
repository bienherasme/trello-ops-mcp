import { describe, expect, it } from "vitest";
import { classifyListAction } from "../../src/domain/listChanges.js";
import {
  archiveListAction,
  createCardAction,
  createListAction,
  moveCardAction,
  renameListAction,
  reorderListAction,
  unarchiveListAction,
} from "../fixtures/trelloActions.js";

describe("classifyListAction", () => {
  it("classifies createList as list_created with actor/board/entity details", () => {
    const event = classifyListAction(createListAction);
    expect(event).toMatchObject({
      type: "list_created",
      category: "structural",
      entityType: "list",
      entityId: "5f0000000000000000000010",
      entityName: "Backlog",
      boardId: "5f0000000000000000000001",
      actor: { id: "5f0000000000000000000002", name: "Ada Lovelace", username: "ada" },
    });
  });

  it("classifies a list rename with the correct from/to names", () => {
    const event = classifyListAction(renameListAction);
    expect(event).toMatchObject({
      type: "list_renamed",
      entityId: "5f0000000000000000000010",
      from: "Backlog",
      to: "Backlog Renamed",
    });
  });

  it.each([
    { label: "archive (closed: false -> true)", action: archiveListAction, expectedType: "list_archived" },
    { label: "unarchive (closed: true -> false)", action: unarchiveListAction, expectedType: "list_unarchived" },
  ] as const)("classifies $label as $expectedType", ({ action, expectedType }) => {
    expect(classifyListAction(action)).toMatchObject({ type: expectedType, entityId: "5f0000000000000000000010" });
  });

  it("safely ignores unrecognized updateList sub-variants (e.g. reorder) and unrelated action types", () => {
    expect(classifyListAction(reorderListAction)).toBeNull();
    expect(classifyListAction(createCardAction)).toBeNull();
    expect(classifyListAction(moveCardAction)).toBeNull();
  });
});
