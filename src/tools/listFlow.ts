import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classifyCardMovements } from "../domain/cardMovements.js";
import { computeListFlow, type ListFlow } from "../domain/movementAnalytics.js";
import { getTrelloClient } from "../trello/client.js";
import { resolveDateRange } from "../utils/dates.js";
import { requestedRangeSchema } from "./auditEventSchema.js";
import { formatToolError } from "./errorFormatting.js";
import { beforeSchema, boardRefSchema, daysSchema, maxActionsSchema, sinceSchema } from "./schemas.js";

const listFlowEntrySchema = z.object({
  listId: z.string(),
  listName: z.string().nullable(),
  incomingMoves: z.number(),
  outgoingMoves: z.number(),
  netFlow: z.number(),
});

export function formatListFlowText(flow: ListFlow[]): string {
  if (flow.length === 0) return "No card movements found in this range.";
  const lines = flow.map((f) => {
    const sign = f.netFlow >= 0 ? "+" : "";
    return `- ${f.listName ?? f.listId}: in ${f.incomingMoves}, out ${f.outgoingMoves}, net ${sign}${f.netFlow}`;
  });
  return ["Card movement flow by list (a factual signal, not a bottleneck judgment):", ...lines].join("\n");
}

export function registerListFlowTool(server: McpServer): void {
  server.registerTool(
    "get_list_flow",
    {
      title: "Get List Flow",
      description:
        "Returns incoming and outgoing card movement counts by Trello list for a date range (explicit " +
        "since/before, or the convenience `days` — default last 7 days if neither is given). Useful for " +
        "seeing where card movement concentrates. This is a factual movement-flow signal only — it does " +
        "not identify bottlenecks, throughput, or performance; that interpretation is left to the caller.",
      inputSchema: {
        board: boardRefSchema,
        since: sinceSchema,
        before: beforeSchema,
        days: daysSchema,
        maxActions: maxActionsSchema,
      },
      outputSchema: {
        flow: z.array(listFlowEntrySchema),
        totalMovements: z.number(),
        actionsScanned: z.number(),
        truncated: z.boolean(),
        requestedRange: requestedRangeSchema,
      },
    },
    async ({ board, since, before, days, maxActions }) => {
      try {
        const range = resolveDateRange({ since, before, days }, new Date(), 7);
        const result = await getTrelloClient().getBoardActions(board, {
          since: range.since,
          before: range.before,
          filter: ["updateCard"],
          maxActions,
        });
        const movements = classifyCardMovements(result.actions);

        // Default ordering: descending total activity (incoming + outgoing),
        // tie-broken by listId for determinism. computeListFlow itself
        // returns listId-ascending order; this re-sort is presentation only.
        const flow = computeListFlow(movements).sort((a, b) => {
          const activityDelta = b.incomingMoves + b.outgoingMoves - (a.incomingMoves + a.outgoingMoves);
          return activityDelta !== 0 ? activityDelta : a.listId.localeCompare(b.listId);
        });

        return {
          content: [{ type: "text", text: formatListFlowText(flow) }],
          structuredContent: {
            flow,
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
