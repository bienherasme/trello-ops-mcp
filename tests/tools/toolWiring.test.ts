import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerDiscoveryTools } from "../../src/tools/discovery.js";
import { registerMemberActivityTool } from "../../src/tools/memberActivity.js";
import { getTrelloClient } from "../../src/trello/client.js";
import type { TrelloClient } from "../../src/trello/client.js";
import { createListAction, moveCardAction, moveCardActionByMember2 } from "../fixtures/trelloActions.js";

/**
 * All MCP tools share the same registration/validation/response pattern
 * (zod input schema -> client call -> structuredContent + text -> safe
 * error formatting). Rather than re-testing that pattern once per tool,
 * these two tests exercise one representative "discovery" tool
 * (get_board_lists: a thin typed pass-through) and one representative
 * "analytics" tool (get_member_activity: fetch + filter + classify +
 * resolve-by-name), which together prove the wiring works end-to-end for
 * every tool built on the same foundations.
 */

vi.mock("../../src/trello/client.js", () => ({
  getTrelloClient: vi.fn(),
}));

const mockedGetTrelloClient = vi.mocked(getTrelloClient);

async function connectedClient(register: (server: McpServer) => void): Promise<Client> {
  const server = new McpServer({ name: "test-server", version: "0.0.0" });
  register(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("MCP tool wiring", () => {
  beforeEach(() => mockedGetTrelloClient.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("a discovery tool (get_board_lists) validates input, calls the Trello client, and returns matching structured content — rejecting invalid input before any call", async () => {
    const getBoardLists = vi.fn().mockResolvedValue([{ id: "l1", name: "To Do", closed: false, pos: 1 }]);
    mockedGetTrelloClient.mockReturnValue({ getBoardLists } as unknown as TrelloClient);

    const client = await connectedClient(registerDiscoveryTools);

    const ok = await client.callTool({
      name: "get_board_lists",
      arguments: { board: "abc12345", includeClosed: true },
    });
    expect(getBoardLists).toHaveBeenCalledWith("abc12345", { includeClosed: true });
    expect(ok.structuredContent).toEqual({ lists: [{ id: "l1", name: "To Do", closed: false, pos: 1 }] });

    const rejected = await client.callTool({ name: "get_board_lists", arguments: { board: "" } });
    expect(rejected.isError).toBe(true);
    expect(getBoardLists).toHaveBeenCalledTimes(1); // not called again for the invalid request
  });

  it("an analytics tool (get_member_activity) fetches actions, filters by member, classifies them, reports metadata, and surfaces domain errors safely", async () => {
    const getBoardActions = vi.fn().mockResolvedValue({
      actions: [createListAction, moveCardAction, moveCardActionByMember2],
      actionsScanned: 3,
      truncated: false,
      requestedRange: { since: "2026-01-01T00:00:00.000Z" },
    });
    const getBoardMembers = vi.fn().mockResolvedValue([
      { id: "5f0000000000000000000002", fullName: "Ada Lovelace", username: "ada" },
      { id: "5f0000000000000000000002", fullName: "Ada Lovelace", username: "ada-duplicate" },
    ]);
    mockedGetTrelloClient.mockReturnValue({
      getBoardActions,
      getBoardMembers,
    } as unknown as TrelloClient);

    const client = await connectedClient(registerMemberActivityTool);

    // Filters mixed-actor actions down to the requested member and classifies them.
    const result = await client.callTool({
      name: "get_member_activity",
      arguments: { board: "abc12345", memberId: "5f0000000000000000000002" },
    });
    const structured = result.structuredContent as {
      events: Array<{ type: string }>;
      memberId: string;
      actionsScanned: number;
      matchedEvents: number;
      truncated: boolean;
      requestedRange: unknown;
    };
    expect(structured.memberId).toBe("5f0000000000000000000002");
    expect(structured.events.map((e) => e.type)).toEqual(["card_moved", "list_created"]);
    expect(structured.actionsScanned).toBe(3);
    expect(structured.matchedEvents).toBe(2);
    expect(structured.truncated).toBe(false);
    expect(structured.requestedRange).toEqual({ since: "2026-01-01T00:00:00.000Z" });

    // A domain error (here: ambiguous memberName) is caught and surfaced as isError, not thrown.
    const ambiguous = await client.callTool({
      name: "get_member_activity",
      arguments: { board: "abc12345", memberName: "Ada Lovelace" },
    });
    expect(ambiguous.isError).toBe(true);
  });
});
