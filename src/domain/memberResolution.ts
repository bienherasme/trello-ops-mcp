import type { TrelloMember } from "../trello/types.js";

export class MemberNotFoundError extends Error {
  constructor(name: string) {
    super(`No board member matches "${name}"`);
    this.name = "MemberNotFoundError";
  }
}

export class AmbiguousMemberNameError extends Error {
  constructor(name: string, matches: TrelloMember[]) {
    const usernames = matches.map((m) => `@${m.username}`).join(", ");
    super(`Multiple board members match "${name}": ${usernames}. Use memberId instead.`);
    this.name = "AmbiguousMemberNameError";
  }
}

/**
 * Resolves a human-entered name against a board's member list by exact,
 * case-insensitive match on fullName or username. Throws rather than
 * guessing when zero or multiple members match — callers that can supply
 * memberId directly should prefer that and skip this entirely.
 */
export function resolveMemberByName(members: TrelloMember[], name: string): TrelloMember {
  const query = name.trim().toLowerCase();
  const matches = members.filter(
    (member) => member.username.toLowerCase() === query || member.fullName?.toLowerCase() === query,
  );

  if (matches.length === 0) throw new MemberNotFoundError(name);
  if (matches.length > 1) throw new AmbiguousMemberNameError(name, matches);
  return matches[0] as TrelloMember;
}
