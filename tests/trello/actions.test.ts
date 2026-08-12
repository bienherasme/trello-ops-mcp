import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrelloClient } from "../../src/trello/client.js";
import type { TrelloAction } from "../../src/trello/types.js";
import { makeSyntheticListActions } from "../fixtures/trelloActions.js";

const FAKE_KEY = "fake-test-api-key";
const FAKE_TOKEN = "fake-test-token";

function client(): TrelloClient {
  return new TrelloClient({ apiKey: FAKE_KEY, token: FAKE_TOKEN });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** Emulates Trello's actions endpoint: newest-first, `before=<id>` excludes that action and everything newer. */
function makePaginatedFetchMock(allActionsNewestFirst: TrelloAction[]) {
  return vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get("limit"));
    const before = url.searchParams.get("before");
    let startIndex = 0;
    if (before) {
      const idx = allActionsNewestFirst.findIndex((a) => a.id === before);
      startIndex = idx === -1 ? allActionsNewestFirst.length : idx + 1;
    }
    return jsonResponse(allActionsNewestFirst.slice(startIndex, startIndex + limit));
  });
}

describe("TrelloClient.getBoardActions pagination", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("pages across multiple requests via the before cursor until a short page signals the range is exhausted", async () => {
    const all = makeSyntheticListActions(5);
    fetchMock.mockImplementation(makePaginatedFetchMock(all));

    const result = await client().getBoardActions("abc12345", { limit: 2 });

    expect(result.actions).toHaveLength(5);
    expect(result.actionsScanned).toBe(5);
    expect(result.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 + 2 + 1

    // A genuinely empty history exhausts the same way, on the first page.
    fetchMock.mockReset();
    fetchMock.mockImplementation(makePaginatedFetchMock([]));
    const empty = await client().getBoardActions("abc12345");
    expect(empty.actions).toEqual([]);
    expect(empty.truncated).toBe(false);
  });

  it("stops and marks truncated once maxActions is reached, without over-fetching beyond the cap", async () => {
    const all = makeSyntheticListActions(10);
    fetchMock.mockImplementation(makePaginatedFetchMock(all));

    const result = await client().getBoardActions("abc12345", { limit: 2, maxActions: 3 });

    expect(result.actionsScanned).toBe(3);
    expect(result.truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 2 + 1 to reach the cap of 3
  });
});
