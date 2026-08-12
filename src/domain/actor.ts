import type { TrelloActionMemberCreator } from "../trello/types.js";
import type { AuditActor } from "./types.js";

export function toActor(memberCreator: TrelloActionMemberCreator): AuditActor {
  return { id: memberCreator.id, name: memberCreator.fullName, username: memberCreator.username };
}
