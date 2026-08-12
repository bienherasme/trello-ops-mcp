import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classifyListChanges } from "../domain/listChanges.js";
import type { AuditEvent } from "../domain/types.js";
import { getTrelloClient } from "../trello/client.js";
import type { TrelloAction } from "../trello/types.js";
import { auditEventSchema, requestedRangeSchema } from "./auditEventSchema.js";
import { formatToolError } from "./errorFormatting.js";
import {
  actionTypesSchema,
  beforeSchema,
  boardRefSchema,
  listIdSchema,
  maxActionsSchema,
  sinceSchema,
} from "./schemas.js";

/**
 * Actions tools: get_board_actions is a low-level historical inspection/
 * debug tool over the raw (but compacted) Trello action feed; get_list_changes
 * is the main structural audit tool, built on the pure classifiers in
 * src/domain/listChanges.ts. Neither performs its own HTTP — both go through
 * TrelloClient.getBoardActions.
 */

interface CompactActionRef {
  id: string;
  name?: string | undefined;
}

interface CompactActionListRef extends CompactActionRef {
  closed?: boolean | undefined;
}

interface CompactAction {
  id: string;
  type: string;
  date: string;
  actor: { id: string; name: string | null; username: string };
  list?: CompactActionListRef | undefined;
  listBefore?: CompactActionRef | undefined;
  listAfter?: CompactActionRef | undefined;
  card?: CompactActionRef | undefined;
  old?: Record<string, unknown> | undefined;
}

const compactActorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string(),
});
const compactRefSchema = z.object({ id: z.string(), name: z.string().optional() });
const compactListRefSchema = compactRefSchema.extend({ closed: z.boolean().optional() });

const compactActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string(),
  actor: compactActorSchema,
  list: compactListRefSchema.optional(),
  listBefore: compactRefSchema.optional(),
  listAfter: compactRefSchema.optional(),
  card: compactRefSchema.optional(),
  old: z.record(z.string(), z.unknown()).optional(),
});

export function toCompactAction(action: TrelloAction): CompactAction {
  const compact: CompactAction = {
    id: action.id,
    type: action.type,
    date: action.date,
    actor: {
      id: action.memberCreator.id,
      name: action.memberCreator.fullName,
      username: action.memberCreator.username,
    },
  };

  if (action.data.list) {
    compact.list = {
      id: action.data.list.id,
      name: action.data.list.name,
      closed: action.data.list.closed,
    };
  }
  if (action.data.listBefore) {
    compact.listBefore = { id: action.data.listBefore.id, name: action.data.listBefore.name };
  }
  if (action.data.listAfter) {
    compact.listAfter = { id: action.data.listAfter.id, name: action.data.listAfter.name };
  }
  if (action.data.card) {
    compact.card = { id: action.data.card.id, name: action.data.card.name };
  }
  if (action.data.old) {
    compact.old = action.data.old;
  }

  return compact;
}

export function formatActionsText(actions: CompactAction[]): string {
  if (actions.length === 0) return "No actions found.";
  const lines = actions.map((action) => {
    const who = `${action.actor.name ?? action.actor.username} (@${action.actor.username})`;
    const target = action.list?.name ?? action.card?.name;
    return `- [${action.date}] ${action.type} by ${who}${target ? ` — ${target}` : ""}`;
  });
  return [`Found ${actions.length} action(s):`, ...lines].join("\n");
}

export function formatListChangesText(events: AuditEvent[]): string {
  if (events.length === 0) return "No structural list changes found.";
  const lines = events.map((event) => {
    const who = `${event.actor.name ?? event.actor.username} (@${event.actor.username})`;
    switch (event.type) {
      case "list_created":
        return `- [${event.timestamp}] ${who} created list "${event.entityName ?? event.entityId}"`;
      case "list_renamed":
        return `- [${event.timestamp}] ${who} renamed list "${event.from}" → "${event.to}"`;
      case "list_archived":
        return `- [${event.timestamp}] ${who} archived list "${event.entityName ?? event.entityId}"`;
      case "list_unarchived":
        return `- [${event.timestamp}] ${who} unarchived list "${event.entityName ?? event.entityId}"`;
      default:
        return `- [${event.timestamp}] ${who} ${event.type} on list "${event.entityName ?? event.entityId}"`;
    }
  });
  return [`Found ${events.length} structural list change(s):`, ...lines].join("\n");
}

export function registerActionsTools(server: McpServer): void {
  server.registerTool(
    "get_board_actions",
    {
      title: "Get Board Actions",
      description:
        "Low-level historical inspection/debug tool: returns a compact, normalized view of a board's " +
        "raw action history. For structural list-change auditing, prefer get_list_changes.",
      inputSchema: {
        board: boardRefSchema,
        since: sinceSchema,
        before: beforeSchema,
        actionTypes: actionTypesSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        actions: z.array(compactActionSchema),
        actionsScanned: z.number(),
        truncated: z.boolean(),
        requestedRange: requestedRangeSchema,
      },
    },
    async ({ board, since, before, actionTypes, maxActions }) => {
      try {
        const result = await getTrelloClient().getBoardActions(board, {
          since,
          before,
          filter: actionTypes,
          maxActions,
        });
        const actions = result.actions.map(toCompactAction);
        return {
          content: [{ type: "text", text: formatActionsText(actions) }],
          structuredContent: {
            actions,
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

  server.registerTool(
    "get_list_changes",
    {
      title: "Get List Changes",
      description:
        "Main structural audit tool: who created, renamed, archived, or unarchived lists on a board, " +
        "optionally scoped to a date range and/or a single list.",
      inputSchema: {
        board: boardRefSchema,
        since: sinceSchema,
        before: beforeSchema,
        listId: listIdSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        events: z.array(auditEventSchema),
        actionsScanned: z.number(),
        matchedEvents: z.number(),
        truncated: z.boolean(),
        requestedRange: requestedRangeSchema,
      },
    },
    async ({ board, since, before, listId, maxActions }) => {
      try {
        const result = await getTrelloClient().getBoardActions(board, {
          since,
          before,
          filter: ["createList", "updateList"],
          maxActions,
        });
        const events = classifyListChanges(result.actions, { listId });
        return {
          content: [{ type: "text", text: formatListChangesText(events) }],
          structuredContent: {
            events,
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
