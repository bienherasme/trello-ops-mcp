import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getLastActivityByCard } from "../domain/cardActivity.js";
import { findStaleCards, type StaleCard } from "../domain/staleCards.js";
import { getTrelloClient } from "../trello/client.js";
import { formatToolError } from "./errorFormatting.js";
import { boardRefSchema, listIdSchema, maxActionsSchema, memberIdSchema, staleDaysSchema } from "./schemas.js";

const DEFAULT_STALE_DAYS = 14;

interface EnrichedStaleCard extends StaleCard {
  listName: string | undefined;
  memberNames: string[];
}

/**
 * Enriches list/member IDs with human-readable names, fetching each at
 * most once per call (skipped entirely with no stale cards). Deliberately
 * not shared with the equivalent helper in dueDates.ts — keeping each
 * tool module self-contained is a small tradeoff against a few duplicated
 * lines here, in exchange for tools that can be read and changed in
 * isolation.
 */
async function enrichStaleCards(board: string, cards: StaleCard[]): Promise<EnrichedStaleCard[]> {
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

const staleCardSchema = z.object({
  cardId: z.string(),
  cardName: z.string(),
  listId: z.string(),
  listName: z.string().optional(),
  memberIds: z.array(z.string()),
  memberNames: z.array(z.string()),
  lastActivityAt: z.string().nullable(),
  daysSinceActivity: z.number().nullable(),
  historyComplete: z.boolean(),
});

export function formatStaleCardsText(cards: EnrichedStaleCard[]): string {
  if (cards.length === 0) return "No stale cards found.";
  const lines = cards.map((card) => {
    const age =
      card.daysSinceActivity !== null
        ? `${card.daysSinceActivity}d since last activity`
        : "last activity unknown" + (card.historyComplete ? " (no recorded activity found)" : " (history scan was truncated)");
    return `- "${card.cardName}" — ${age}, list "${card.listName ?? card.listId}"`;
  });
  return ["Stale cards (no recognized recent activity — not necessarily blocked):", ...lines].join("\n");
}

export function registerStaleCardsTool(server: McpServer): void {
  server.registerTool(
    "get_stale_cards",
    {
      title: "Get Stale Cards",
      description:
        "Returns open cards with no recognized activity (creation, list move, archive/unarchive) for at " +
        "least `staleDays` (default 14). Stale does not imply blocked — Trello data alone can't say why a " +
        "card hasn't moved. When the underlying action history couldn't be fully scanned, affected cards " +
        "are still returned but marked `historyComplete: false` rather than silently assumed stale.",
      inputSchema: {
        board: boardRefSchema,
        staleDays: staleDaysSchema,
        listId: listIdSchema,
        memberId: memberIdSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        cards: z.array(staleCardSchema),
        staleThresholdDays: z.number(),
        actionsScanned: z.number(),
        truncated: z.boolean(),
        evaluatedAt: z.string(),
        totalStale: z.number(),
      },
    },
    async ({ board, staleDays, listId, memberId, maxActions }) => {
      try {
        const now = new Date();
        const effectiveStaleDays = staleDays ?? DEFAULT_STALE_DAYS;
        const client = getTrelloClient();

        const [cards, actionsResult] = await Promise.all([
          client.getBoardCards(board),
          client.getBoardActions(board, { filter: ["createCard", "updateCard"], maxActions }),
        ]);

        const lastActivityByCard = getLastActivityByCard(actionsResult.actions);
        const stale = findStaleCards(cards, lastActivityByCard, now, effectiveStaleDays, !actionsResult.truncated, {
          listId,
          memberId,
        });
        const enriched = await enrichStaleCards(board, stale);

        return {
          content: [{ type: "text", text: formatStaleCardsText(enriched) }],
          structuredContent: {
            cards: enriched,
            staleThresholdDays: effectiveStaleDays,
            actionsScanned: actionsResult.actionsScanned,
            truncated: actionsResult.truncated,
            evaluatedAt: now.toISOString(),
            totalStale: enriched.length,
          },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );
}
