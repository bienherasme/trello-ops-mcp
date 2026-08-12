import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findOverdueCards, findUpcomingCards, type OverdueCard, type UpcomingCard } from "../domain/dueDates.js";
import { getTrelloClient } from "../trello/client.js";
import { formatToolError } from "./errorFormatting.js";
import { boardRefSchema, listIdSchema, memberIdSchema, withinDaysSchema } from "./schemas.js";

const DEFAULT_WITHIN_DAYS = 7;

interface EnrichedOverdueCard extends OverdueCard {
  listName: string | undefined;
  memberNames: string[];
}

interface EnrichedUpcomingCard extends UpcomingCard {
  listName: string | undefined;
  memberNames: string[];
}

/**
 * Enriches list/member IDs with human-readable names. Fetches board lists
 * and members at most once per tool call (skipped entirely when there are
 * no cards to enrich) rather than once per card, to avoid N+1 Trello
 * requests on boards with many overdue/upcoming cards.
 */
async function enrichDueCards<T extends { listId: string; memberIds: string[] }>(
  board: string,
  cards: T[],
): Promise<Array<T & { listName: string | undefined; memberNames: string[] }>> {
  if (cards.length === 0) return [];

  const client = getTrelloClient();
  const [lists, members] = await Promise.all([
    client.getBoardLists(board, { includeClosed: true }),
    client.getBoardMembers(board),
  ]);
  const listNameById = new Map(lists.map((list) => [list.id, list.name]));
  const memberNameById = new Map(members.map((member) => [member.id, member.fullName ?? member.username]));

  return cards.map((card) => ({
    ...card,
    listName: listNameById.get(card.listId),
    memberNames: card.memberIds
      .map((id) => memberNameById.get(id))
      .filter((name): name is string => name !== undefined),
  }));
}

const overdueCardSchema = z.object({
  cardId: z.string(),
  cardName: z.string(),
  listId: z.string(),
  listName: z.string().optional(),
  due: z.string(),
  daysOverdue: z.number(),
  memberIds: z.array(z.string()),
  memberNames: z.array(z.string()),
});

const upcomingCardSchema = z.object({
  cardId: z.string(),
  cardName: z.string(),
  listId: z.string(),
  listName: z.string().optional(),
  due: z.string(),
  daysUntilDue: z.number(),
  memberIds: z.array(z.string()),
  memberNames: z.array(z.string()),
});

export function formatOverdueText(cards: EnrichedOverdueCard[]): string {
  if (cards.length === 0) return "No overdue cards.";
  const lines = cards.map(
    (card) =>
      `- "${card.cardName}" — ${card.daysOverdue}d overdue, due ${card.due}, list "${card.listName ?? card.listId}"`,
  );
  return [`Found ${cards.length} overdue card(s):`, ...lines].join("\n");
}

export function formatUpcomingText(cards: EnrichedUpcomingCard[]): string {
  if (cards.length === 0) return "No upcoming due cards in this window.";
  const lines = cards.map(
    (card) =>
      `- "${card.cardName}" — due in ${card.daysUntilDue}d (${card.due}), list "${card.listName ?? card.listId}"`,
  );
  return [`Found ${cards.length} upcoming card(s):`, ...lines].join("\n");
}

export function registerDueDateTools(server: McpServer): void {
  server.registerTool(
    "get_overdue_cards",
    {
      title: "Get Overdue Cards",
      description:
        "Cards with a past-due date that aren't marked complete and aren't archived, based on the " +
        "board's current card state (not action history). Sorted most-overdue first.",
      inputSchema: { board: boardRefSchema, listId: listIdSchema, memberId: memberIdSchema },
      outputSchema: {
        cards: z.array(overdueCardSchema),
        totalOverdue: z.number(),
        board: z.string(),
        evaluatedAt: z.string(),
      },
    },
    async ({ board, listId, memberId }) => {
      try {
        const now = new Date();
        const cards = await getTrelloClient().getBoardCards(board);
        const overdue = findOverdueCards(cards, now, { listId, memberId });
        const enriched = await enrichDueCards(board, overdue);

        return {
          content: [{ type: "text", text: formatOverdueText(enriched) }],
          structuredContent: {
            cards: enriched,
            totalOverdue: enriched.length,
            board,
            evaluatedAt: now.toISOString(),
          },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );

  server.registerTool(
    "get_upcoming_due_cards",
    {
      title: "Get Upcoming Due Cards",
      description:
        "Cards due within the next N days (default 7) that aren't marked complete and aren't archived, " +
        "based on the board's current card state (not action history). Sorted soonest-due first.",
      inputSchema: {
        board: boardRefSchema,
        withinDays: withinDaysSchema,
        listId: listIdSchema,
        memberId: memberIdSchema,
      },
      outputSchema: {
        cards: z.array(upcomingCardSchema),
        totalUpcoming: z.number(),
        withinDays: z.number(),
        evaluatedAt: z.string(),
      },
    },
    async ({ board, withinDays, listId, memberId }) => {
      try {
        const now = new Date();
        const effectiveWithinDays = withinDays ?? DEFAULT_WITHIN_DAYS;
        const cards = await getTrelloClient().getBoardCards(board);
        const upcoming = findUpcomingCards(cards, now, effectiveWithinDays, { listId, memberId });
        const enriched = await enrichDueCards(board, upcoming);

        return {
          content: [{ type: "text", text: formatUpcomingText(enriched) }],
          structuredContent: {
            cards: enriched,
            totalUpcoming: enriched.length,
            withinDays: effectiveWithinDays,
            evaluatedAt: now.toISOString(),
          },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );
}
