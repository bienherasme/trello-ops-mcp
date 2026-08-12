import { describe, expect, it } from "vitest";
import { classifyMemberActivity } from "../../src/domain/cardActivity.js";
import {
  AmbiguousMemberNameError,
  MemberNotFoundError,
  resolveMemberByName,
} from "../../src/domain/memberResolution.js";
import type { TrelloMember } from "../../src/trello/types.js";
import { createListAction, moveCardAction, renameListAction } from "../fixtures/trelloActions.js";

const members: TrelloMember[] = [
  { id: "m1", fullName: "Ada Lovelace", username: "ada" },
  { id: "m2", fullName: "Grace Hopper", username: "grace" },
];

describe("resolveMemberByName", () => {
  it("resolves uniquely by username or fullName, case-insensitively", () => {
    expect(resolveMemberByName(members, "grace")).toEqual(members[1]);
    expect(resolveMemberByName(members, "ADA LOVELACE")).toEqual(members[0]);
  });

  it.each([
    ["a name matching no one", "Nobody Here", MemberNotFoundError],
    ["a name matching multiple members", "Ada Lovelace", AmbiguousMemberNameError],
  ])("rejects %s with a clear, distinct error", (_label, query, expectedError) => {
    const pool = query === "Ada Lovelace" ? [...members, { id: "m3", fullName: "Ada Lovelace", username: "ada2" }] : members;
    expect(() => resolveMemberByName(pool, query)).toThrow(expectedError);
  });
});

describe("classifyMemberActivity", () => {
  it("merges list-structural and card events into one chronological (newest-first) feed, dropping unrecognized actions", () => {
    const events = classifyMemberActivity([createListAction, renameListAction, moveCardAction]);
    expect(events.map((e) => e.type)).toEqual(["card_moved", "list_renamed", "list_created"]);
  });
});
