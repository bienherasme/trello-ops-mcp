import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTrelloClient } from "../trello/client.js";
import { trelloBoardSchema, trelloCardSchema, trelloListSchema, trelloMemberSchema } from "../trello/types.js";
import type { TrelloBoard, TrelloCard, TrelloList, TrelloMember } from "../trello/types.js";
import { formatToolError } from "./errorFormatting.js";
import { boardRefSchema, includeClosedSchema } from "./schemas.js";

/**
 * Discovery tools: thin, typed pass-throughs over the Trello client with no
 * audit/analytics logic. They exist so an MCP client can resolve board,
 * list, member, and card identifiers that the audit/analytics tools take
 * as input (e.g. a listId or memberId for filtering).
 */
export function registerDiscoveryTools(server: McpServer): void {
  server.registerTool(
    "get_boards",
    {
      title: "Get Boards",
      description: "Get the Trello boards accessible to the configured account.",
      outputSchema: { boards: z.array(trelloBoardSchema) },
    },
    async () => {
      try {
        const boards = await getTrelloClient().getMyBoards();
        return {
          content: [{ type: "text", text: formatBoardsText(boards) }],
          structuredContent: { boards },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );

  server.registerTool(
    "get_board_lists",
    {
      title: "Get Board Lists",
      description: "Get the lists on a Trello board, identified by ID, shortLink, or board URL.",
      inputSchema: { board: boardRefSchema, includeClosed: includeClosedSchema },
      outputSchema: { lists: z.array(trelloListSchema) },
    },
    async ({ board, includeClosed }) => {
      try {
        const lists = await getTrelloClient().getBoardLists(board, { includeClosed });
        return {
          content: [{ type: "text", text: formatListsText(lists) }],
          structuredContent: { lists },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );

  server.registerTool(
    "get_board_members",
    {
      title: "Get Board Members",
      description: "Get the members on a Trello board, identified by ID, shortLink, or board URL.",
      inputSchema: { board: boardRefSchema },
      outputSchema: { members: z.array(trelloMemberSchema) },
    },
    async ({ board }) => {
      try {
        const members = await getTrelloClient().getBoardMembers(board);
        return {
          content: [{ type: "text", text: formatMembersText(members) }],
          structuredContent: { members },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );

  server.registerTool(
    "get_board_cards",
    {
      title: "Get Board Cards",
      description:
        "Get the cards on a Trello board, identified by ID, shortLink, or board URL. " +
        "Returns raw card data (list, members, due date) — no overdue/analytics computation.",
      inputSchema: { board: boardRefSchema, includeClosed: includeClosedSchema },
      outputSchema: { cards: z.array(trelloCardSchema) },
    },
    async ({ board, includeClosed }) => {
      try {
        const cards = await getTrelloClient().getBoardCards(board, { includeClosed });
        return {
          content: [{ type: "text", text: formatCardsText(cards) }],
          structuredContent: { cards },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
      }
    },
  );
}

export function formatBoardsText(boards: TrelloBoard[]): string {
  if (boards.length === 0) return "No boards found.";
  const lines = boards.map(
    (board) =>
      `- ${board.name} — id:${board.id} shortLink:${board.shortLink}${board.closed ? " [closed]" : ""}`,
  );
  return [`Found ${boards.length} board(s):`, ...lines].join("\n");
}

export function formatListsText(lists: TrelloList[]): string {
  if (lists.length === 0) return "No lists found.";
  const lines = lists.map(
    (list) => `- ${list.name} — id:${list.id} pos:${list.pos}${list.closed ? " [closed]" : ""}`,
  );
  return [`Found ${lists.length} list(s):`, ...lines].join("\n");
}

export function formatMembersText(members: TrelloMember[]): string {
  if (members.length === 0) return "No members found.";
  const lines = members.map(
    (member) => `- ${member.fullName ?? member.username} (@${member.username}) — id:${member.id}`,
  );
  return [`Found ${members.length} member(s):`, ...lines].join("\n");
}

export function formatCardsText(cards: TrelloCard[]): string {
  if (cards.length === 0) return "No cards found.";
  const lines = cards.map((card) => {
    const due = card.due ? ` due:${card.due}${card.dueComplete ? " (complete)" : ""}` : "";
    const closed = card.closed ? " [closed]" : "";
    return `- ${card.name} — id:${card.id} list:${card.idList}${due}${closed}`;
  });
  return [`Found ${cards.length} card(s):`, ...lines].join("\n");
}
