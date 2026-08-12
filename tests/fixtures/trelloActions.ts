import type { TrelloAction } from "../../src/trello/types.js";

/**
 * Sanitized fixtures modeled on real Trello action payloads (board/list/
 * member IDs and names replaced with synthetic values — no real customer
 * or business data). Field names and nesting match what Trello actually
 * returns for these action types when requested with
 * fields=id,type,date,idMemberCreator,data and
 * memberCreator_fields=fullName,username.
 */

const BOARD_REF = { id: "5f0000000000000000000001", name: "Test Board", shortLink: "testboard" };
const MEMBER_REF = { id: "5f0000000000000000000002", fullName: "Ada Lovelace", username: "ada" };
const MEMBER_REF2 = { id: "5f0000000000000000000003", fullName: "Grace Hopper", username: "grace" };
const LIST_REF = { id: "5f0000000000000000000010", name: "Backlog" };
const LIST_REF2 = { id: "5f0000000000000000000011", name: "In Progress" };
const CARD_REF = { id: "5f0000000000000000000200", name: "Sample Card" };

export const createListAction: TrelloAction = {
  id: "5f0000000000000000000100",
  type: "createList",
  date: "2026-08-12T21:11:58.501Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    list: { id: LIST_REF.id, name: LIST_REF.name },
    board: BOARD_REF,
  },
};

export const renameListAction: TrelloAction = {
  id: "5f0000000000000000000101",
  type: "updateList",
  date: "2026-08-12T21:12:01.268Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    list: { id: LIST_REF.id, name: "Backlog Renamed" },
    old: { name: LIST_REF.name },
    board: BOARD_REF,
  },
};

export const archiveListAction: TrelloAction = {
  id: "5f0000000000000000000102",
  type: "updateList",
  date: "2026-08-12T21:12:07.122Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    list: { id: LIST_REF.id, name: LIST_REF.name, closed: true },
    old: { closed: false },
    board: BOARD_REF,
  },
};

export const unarchiveListAction: TrelloAction = {
  id: "5f0000000000000000000103",
  type: "updateList",
  date: "2026-08-12T21:12:09.021Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    list: { id: LIST_REF.id, name: LIST_REF.name, closed: false },
    old: { closed: true },
    board: BOARD_REF,
  },
};

/**
 * A list position (reorder) change. This shape is a reasonable guess, not
 * one captured from real data — it exists only to prove classifyListAction
 * safely ignores an updateList sub-variant it doesn't recognize, rather
 * than to assert Trello's actual reorder payload shape.
 */
export const reorderListAction: TrelloAction = {
  id: "5f0000000000000000000104",
  type: "updateList",
  date: "2026-08-12T21:12:10.000Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    list: { id: LIST_REF.id, name: LIST_REF.name },
    // `old.pos` isn't a modeled field (schema allows it via passthrough at
    // runtime); cast needed since the TS-inferred shape only names the
    // fields classifiers care about.
    old: { pos: 140737488355328 } as TrelloAction["data"]["old"],
    board: BOARD_REF,
  },
};

export const createCardAction: TrelloAction = {
  id: "5f0000000000000000000105",
  type: "createCard",
  date: "2026-08-12T21:11:59.274Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    card: { id: "5f0000000000000000000200", name: "Sample Card", idShort: 12, shortLink: "abc12345" },
    list: LIST_REF,
    board: BOARD_REF,
  },
};

export const moveCardAction: TrelloAction = {
  id: "5f0000000000000000000106",
  type: "updateCard",
  date: "2026-08-12T21:12:05.149Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    old: { idList: "5f0000000000000000000010" },
    card: { id: "5f0000000000000000000200", idList: "5f0000000000000000000011", name: "Sample Card" },
    board: BOARD_REF,
    listBefore: { id: "5f0000000000000000000010", name: "Backlog" },
    listAfter: { id: "5f0000000000000000000011", name: "In Progress" },
  },
};

/** A second, independent list-to-list move by a different member — used for movement-ranking tests. */
export const moveCardActionByMember2: TrelloAction = {
  id: "5f0000000000000000000107",
  type: "updateCard",
  date: "2026-08-12T21:12:06.000Z",
  idMemberCreator: MEMBER_REF2.id,
  memberCreator: { id: MEMBER_REF2.id, fullName: MEMBER_REF2.fullName, username: MEMBER_REF2.username },
  data: {
    old: { idList: LIST_REF2.id },
    card: { id: "5f0000000000000000000201", idList: LIST_REF.id, name: "Second Card" },
    board: BOARD_REF,
    listBefore: { id: LIST_REF2.id, name: LIST_REF2.name },
    listAfter: { id: LIST_REF.id, name: LIST_REF.name },
  },
};

/**
 * A move action missing listBefore/listAfter — the classifier must reject
 * this safely (can't name the lists) rather than guess. Shape plausibility:
 * we've never actually observed Trello omit these on a real move action,
 * but a classifier must not assume required fields are always present.
 */
export const moveCardActionMissingListRefs: TrelloAction = {
  id: "5f0000000000000000000108",
  type: "updateCard",
  date: "2026-08-12T21:12:06.500Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    old: { idList: LIST_REF.id },
    card: { id: CARD_REF.id, idList: LIST_REF2.id, name: CARD_REF.name },
    board: BOARD_REF,
  },
};

/** A card title edit — real shape, but no idList change, so it must be ignored as a movement/card_moved event. */
export const renameCardAction: TrelloAction = {
  id: "5f0000000000000000000109",
  type: "updateCard",
  date: "2026-08-12T21:12:06.700Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    old: { name: "Old Card Title" },
    card: { id: CARD_REF.id, name: "New Card Title" },
    board: BOARD_REF,
    list: LIST_REF,
  },
};

/** A due-date edit — must be ignored as a movement (no idList change). */
export const dueDateEditCardAction: TrelloAction = {
  id: "5f000000000000000000010a",
  type: "updateCard",
  date: "2026-08-12T21:12:06.800Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    old: { due: null } as TrelloAction["data"]["old"],
    card: { id: CARD_REF.id, name: CARD_REF.name },
    board: BOARD_REF,
    list: LIST_REF,
  },
};

/** A member-assignment change — must be ignored as a movement (no idList change). */
export const memberAssignmentCardAction: TrelloAction = {
  id: "5f000000000000000000010b",
  type: "updateCard",
  date: "2026-08-12T21:12:06.900Z",
  idMemberCreator: MEMBER_REF.id,
  memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
  data: {
    old: { idMembers: [] } as unknown as TrelloAction["data"]["old"],
    card: { id: CARD_REF.id, name: CARD_REF.name },
    board: BOARD_REF,
    list: LIST_REF,
  },
};

/** Builds N synthetic, minimal createList actions with sequential ids/dates for pagination tests. */
export function makeSyntheticListActions(count: number, startIndex = 0): TrelloAction[] {
  return Array.from({ length: count }, (_, i) => {
    const n = startIndex + i;
    const suffix = n.toString().padStart(6, "0");
    return {
      id: `5f00000000000000009${suffix}`,
      type: "createList",
      date: new Date(2026, 0, 1, 0, 0, count - n).toISOString(),
      idMemberCreator: MEMBER_REF.id,
      memberCreator: { id: MEMBER_REF.id, fullName: MEMBER_REF.fullName, username: MEMBER_REF.username },
      data: {
        list: { id: `5f00000000000000008${suffix}`, name: `List ${n}` },
        board: BOARD_REF,
      },
    } satisfies TrelloAction;
  });
}
