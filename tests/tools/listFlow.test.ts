import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerListFlowTool } from "../../src/tools/listFlow.js";
import { getTrelloClient } from "../../src/trello/client.js";
import type { TrelloClient } from "../../src/trello/client.js";
import { moveCardAction, moveCardActionByMember2 } from "../fixtures/trelloActions.js";

vi.mock("../../src/trello/client.js", () => ({
  getTrelloClient: vi.fn(),
}));

const mockedGetTrelloClient = vi.mocked(getTrelloClient);

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test-server", version: "0.0.0" });
  registerListFlowTool(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("get_list_flow", () => {
  beforeEach(() => mockedGetTrelloClient.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("computes incoming/outgoing/net flow per list and sorts by total activity descending", async () => {
    // moveCardAction: Backlog -> In Progress. moveCardActionByMember2: In Progress -> Backlog.
    // Backlog: 1 in, 1 out (activity 2). In Progress: 1 in, 1 out (activity 2). Tie -> listId order.
    mockedGetTrelloClient.mockReturnValue({
      getBoardActions: vi.fn().mockResolvedValue({
        actions: [moveCardAction, moveCardActionByMember2],
        actionsScanned: 2,
        truncated: false,
        requestedRange: {},
      }),
    } as unknown as TrelloClient);

    const client = await connectedClient();
    const result = await client.callTool({ name: "get_list_flow", arguments: { board: "abc12345" } });

    const structured = result.structuredContent as { flow: Array<{ listId: string; incomingMoves: number; outgoingMoves: number; netFlow: number }> };
    expect(structured.flow).toEqual([
      { listId: "5f0000000000000000000010", listName: "Backlog", incomingMoves: 1, outgoingMoves: 1, netFlow: 0 },
      { listId: "5f0000000000000000000011", listName: "In Progress", incomingMoves: 1, outgoingMoves: 1, netFlow: 0 },
    ]);
  });

  it("propagates actionsScanned/truncated/requestedRange metadata and rejects an ambiguous since+days combination", async () => {
    const getBoardActions = vi.fn().mockResolvedValue({
      actions: [moveCardAction],
      actionsScanned: 1000,
      truncated: true,
      requestedRange: { since: "2026-06-08T00:00:00.000Z" },
    });
    mockedGetTrelloClient.mockReturnValue({ getBoardActions } as unknown as TrelloClient);

    const client = await connectedClient();
    const result = await client.callTool({ name: "get_list_flow", arguments: { board: "abc12345" } });
    const structured = result.structuredContent as {
      totalMovements: number;
      actionsScanned: number;
      truncated: boolean;
      requestedRange: unknown;
    };
    expect(structured.totalMovements).toBe(1);
    expect(structured.actionsScanned).toBe(1000);
    expect(structured.truncated).toBe(true);
    expect(structured.requestedRange).toEqual({ since: "2026-06-08T00:00:00.000Z" });

    const ambiguous = await client.callTool({
      name: "get_list_flow",
      arguments: { board: "abc12345", since: "2026-01-01T00:00:00.000Z", days: 3 },
    });
    expect(ambiguous.isError).toBe(true);
  });
});
