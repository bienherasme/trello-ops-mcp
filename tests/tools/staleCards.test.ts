import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerStaleCardsTool } from "../../src/tools/staleCards.js";
import { getTrelloClient } from "../../src/trello/client.js";
import type { TrelloClient } from "../../src/trello/client.js";
import type { TrelloCard } from "../../src/trello/types.js";

vi.mock("../../src/trello/client.js", () => ({
  getTrelloClient: vi.fn(),
}));

const mockedGetTrelloClient = vi.mocked(getTrelloClient);

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test-server", version: "0.0.0" });
  registerStaleCardsTool(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function card(overrides: Partial<TrelloCard> = {}): TrelloCard {
  return {
    id: "stale-card",
    name: "Stale Card",
    idList: "list-1",
    idMembers: [],
    due: null,
    dueComplete: false,
    closed: false,
    url: "https://trello.com/c/abc",
    ...overrides,
  };
}

describe("get_stale_cards", () => {
  beforeEach(() => mockedGetTrelloClient.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("returns enriched stale cards with correct threshold/scan metadata, defaulting staleDays to 14", async () => {
    // No actions at all in the scanned (non-truncated) history for this card
    // -> confirmed genuinely stale, not just unknown.
    const getBoardCards = vi.fn().mockResolvedValue([
      card({ id: "5f0000000000000000000200", name: "Sample Card", idList: "5f0000000000000000000010" }),
    ]);
    const getBoardActions = vi.fn().mockResolvedValue({
      actions: [],
      actionsScanned: 0,
      truncated: false,
      requestedRange: {},
    });
    const getBoardLists = vi.fn().mockResolvedValue([{ id: "5f0000000000000000000010", name: "Backlog", closed: false, pos: 1 }]);
    const getBoardMembers = vi.fn().mockResolvedValue([]);
    mockedGetTrelloClient.mockReturnValue({
      getBoardCards,
      getBoardActions,
      getBoardLists,
      getBoardMembers,
    } as unknown as TrelloClient);

    const client = await connectedClient();
    const result = await client.callTool({ name: "get_stale_cards", arguments: { board: "abc12345" } });

    expect(getBoardActions).toHaveBeenCalledWith("abc12345", { filter: ["createCard", "updateCard"], maxActions: undefined });
    const structured = result.structuredContent as {
      cards: Array<{ cardId: string; listName?: string; historyComplete: boolean; lastActivityAt: string | null }>;
      staleThresholdDays: number;
      totalStale: number;
      truncated: boolean;
    };
    expect(structured.staleThresholdDays).toBe(14);
    expect(structured.totalStale).toBe(1);
    expect(structured.truncated).toBe(false);
    expect(structured.cards).toEqual([
      expect.objectContaining({
        cardId: "5f0000000000000000000200",
        listName: "Backlog",
        historyComplete: true,
        lastActivityAt: null,
      }),
    ]);
  });
});
