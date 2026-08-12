import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classifyMemberActivity } from "../domain/cardActivity.js";
import { resolveMemberByName } from "../domain/memberResolution.js";
import type { AuditEvent } from "../domain/types.js";
import { getTrelloClient } from "../trello/client.js";
import { resolveDateRange } from "../utils/dates.js";
import { auditEventSchema, requestedRangeSchema } from "./auditEventSchema.js";
import { formatToolError } from "./errorFormatting.js";
import {
  beforeSchema,
  boardRefSchema,
  daysSchema,
  maxActionsSchema,
  memberIdSchema,
  memberNameSchema,
  sinceSchema,
} from "./schemas.js";

const MEMBER_ACTIVITY_ACTION_TYPES = ["createList", "updateList", "createCard", "updateCard"];

export function formatMemberActivityText(events: AuditEvent[]): string {
  if (events.length === 0) return "No activity found for this member in this range.";
  const lines = events.map((event) => {
    const who = `${event.actor.name ?? event.actor.username} (@${event.actor.username})`;
    const target = event.entityName ?? event.entityId;
    switch (event.type) {
      case "list_renamed":
        return `- [${event.timestamp}] ${who} renamed list "${event.from}" → "${event.to}"`;
      case "card_moved":
        return `- [${event.timestamp}] ${who} moved card "${target}" from "${event.from}" to "${event.to}"`;
      default:
        return `- [${event.timestamp}] ${who} ${event.type} — ${event.entityType} "${target}"`;
    }
  });
  return [`Found ${events.length} activity event(s):`, ...lines].join("\n");
}

export function registerMemberActivityTool(server: McpServer): void {
  server.registerTool(
    "get_member_activity",
    {
      title: "Get Member Activity",
      description:
        "Normalized chronological activity feed for one board member: card movements, list structural " +
        "changes, card creation, and card archival. Resolve by memberId when known; memberName is looked " +
        "up against board members and rejected with a clear error if it's ambiguous or matches no one.",
      inputSchema: {
        board: boardRefSchema,
        memberId: memberIdSchema,
        memberName: memberNameSchema,
        since: sinceSchema,
        before: beforeSchema,
        days: daysSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        events: z.array(auditEventSchema),
        memberId: z.string(),
        actionsScanned: z.number(),
        matchedEvents: z.number(),
        truncated: z.boolean(),
        requestedRange: requestedRangeSchema,
      },
    },
    async ({ board, memberId, memberName, since, before, days, maxActions }) => {
      if (memberId === undefined && memberName === undefined) {
        return {
          isError: true,
          content: [{ type: "text", text: "Provide either memberId or memberName." }],
        };
      }

      try {
        const client = getTrelloClient();
        const actorId =
          memberId ?? resolveMemberByName(await client.getBoardMembers(board), memberName as string).id;

        const range = resolveDateRange({ since, before, days }, new Date(), 7);
        const result = await client.getBoardActions(board, {
          since: range.since,
          before: range.before,
          filter: MEMBER_ACTIVITY_ACTION_TYPES,
          maxActions,
        });

        const memberActions = result.actions.filter((action) => action.idMemberCreator === actorId);
        const events = classifyMemberActivity(memberActions);

        return {
          content: [{ type: "text", text: formatMemberActivityText(events) }],
          structuredContent: {
            events,
            memberId: actorId,
            actionsScanned: result.actionsScanned,
            matchedEvents: events.length,
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
