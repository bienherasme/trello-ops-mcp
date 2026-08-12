import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classifyCardMovements, type CardMovementEvent } from "../domain/cardMovements.js";
import { countMovementsByMember, type MemberMovementCount } from "../domain/movementAnalytics.js";
import { getTrelloClient } from "../trello/client.js";
import { resolveDateRange } from "../utils/dates.js";
import { requestedRangeSchema } from "./auditEventSchema.js";
import { formatToolError } from "./errorFormatting.js";
import {
  beforeSchema,
  boardRefSchema,
  cardIdSchema,
  daysSchema,
  fromListIdSchema,
  limitSchema,
  maxActionsSchema,
  memberIdSchema,
  sinceSchema,
  toListIdSchema,
} from "./schemas.js";

/**
 * `cardsMoved` measures Trello workflow activity — how many list-to-list
 * moves the action log attributes to a member — not employee productivity
 * or performance. Both tool descriptions below say so explicitly.
 */

const movementActorSchema = z.object({ id: z.string(), name: z.string().nullable(), username: z.string() });
const movementRefSchema = z.object({ id: z.string(), name: z.string().optional() });

const cardMovementEventSchema = z.object({
  actionId: z.string(),
  timestamp: z.string(),
  actor: movementActorSchema,
  boardId: z.string(),
  boardName: z.string().optional(),
  card: z.object({ id: z.string(), name: z.string().optional() }),
  fromList: movementRefSchema,
  toList: movementRefSchema,
});

const memberMovementCountSchema = z.object({
  memberId: z.string(),
  memberName: z.string().nullable(),
  username: z.string(),
  cardsMoved: z.number(),
});

export function formatMovementsText(events: CardMovementEvent[]): string {
  if (events.length === 0) return "No card movements found.";
  const lines = events.map((event) => {
    const who = `${event.actor.name ?? event.actor.username} (@${event.actor.username})`;
    const cardName = event.card.name ?? event.card.id;
    const from = event.fromList.name ?? event.fromList.id;
    const to = event.toList.name ?? event.toList.id;
    return `- [${event.timestamp}] ${who} moved "${cardName}" from "${from}" to "${to}"`;
  });
  return [`Found ${events.length} card movement(s):`, ...lines].join("\n");
}

export function formatTopMoversText(movers: Array<MemberMovementCount & { rank: number }>): string {
  if (movers.length === 0) return "No card movements found in this range.";
  const lines = movers.map(
    (m) => `${m.rank}. ${m.memberName ?? m.username} (@${m.username}) — ${m.cardsMoved} card movement(s)`,
  );
  return ["Top card movers (workflow activity, not a productivity ranking):", ...lines].join("\n");
}

export function registerMovementTools(server: McpServer): void {
  server.registerTool(
    "get_card_movements",
    {
      title: "Get Card Movements",
      description:
        "List confirmed list-to-list card movements from a board's action history, optionally filtered " +
        "by member, card, source list, or destination list. Workflow activity, not a productivity metric.",
      inputSchema: {
        board: boardRefSchema,
        since: sinceSchema,
        before: beforeSchema,
        memberId: memberIdSchema,
        cardId: cardIdSchema,
        fromListId: fromListIdSchema,
        toListId: toListIdSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        movements: z.array(cardMovementEventSchema),
        actionsScanned: z.number(),
        matchedMovements: z.number(),
        truncated: z.boolean(),
        requestedRange: requestedRangeSchema,
      },
    },
    async ({ board, since, before, memberId, cardId, fromListId, toListId, maxActions }) => {
      try {
        const result = await getTrelloClient().getBoardActions(board, {
          since,
          before,
          filter: ["updateCard"],
          maxActions,
        });
        const movements = classifyCardMovements(result.actions, {
          memberId,
          cardId,
          fromListId,
          toListId,
        });
        return {
          content: [{ type: "text", text: formatMovementsText(movements) }],
          structuredContent: {
            movements,
            actionsScanned: result.actionsScanned,
            matchedMovements: movements.length,
            truncated: result.truncated,
            requestedRange: result.requestedRange,
          },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );

  server.registerTool(
    "get_top_card_movers",
    {
      title: "Get Top Card Movers",
      description:
        "Ranks board members by list-to-list card movements in a date range (explicit since/before, or " +
        "the convenience `days` — default last 7 days if neither is given). This is a Trello workflow-" +
        "activity metric (cardsMoved), not employee productivity or performance.",
      inputSchema: {
        board: boardRefSchema,
        since: sinceSchema,
        before: beforeSchema,
        days: daysSchema,
        limit: limitSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        movers: z.array(memberMovementCountSchema.extend({ rank: z.number() })),
        totalMovements: z.number(),
        actionsScanned: z.number(),
        truncated: z.boolean(),
        requestedRange: requestedRangeSchema,
      },
    },
    async ({ board, since, before, days, limit, maxActions }) => {
      try {
        const range = resolveDateRange({ since, before, days }, new Date(), 7);
        const result = await getTrelloClient().getBoardActions(board, {
          since: range.since,
          before: range.before,
          filter: ["updateCard"],
          maxActions,
        });
        const movements = classifyCardMovements(result.actions);
        const ranked = countMovementsByMember(movements).map((count, index) => ({
          ...count,
          rank: index + 1,
        }));
        const limited = limit !== undefined ? ranked.slice(0, limit) : ranked;

        return {
          content: [{ type: "text", text: formatTopMoversText(limited) }],
          structuredContent: {
            movers: limited,
            totalMovements: movements.length,
            actionsScanned: result.actionsScanned,
            truncated: result.truncated,
            requestedRange: result.requestedRange,
          },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );
}
