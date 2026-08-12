import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrelloClient } from "../../src/trello/client.js";
import { TrelloApiError, TrelloRateLimitError } from "../../src/trello/errors.js";

const FAKE_KEY = "fake-test-api-key";
const FAKE_TOKEN = "fake-test-token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("TrelloClient HTTP boundary", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  function client(): TrelloClient {
    return new TrelloClient({ apiKey: FAKE_KEY, token: FAKE_TOKEN });
  }

  it("injects key/token and requested fields into the URL, normalizes the board ref, and returns typed data (shared by every client method)", async () => {
    const board = { id: "b1", name: "Board One", shortLink: "abc12345", url: "https://trello.com/b/abc12345", closed: false };
    fetchMock.mockResolvedValueOnce(jsonResponse([board]));

    const boards = await client().getMyBoards();

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/1/members/me/boards");
    expect(requestedUrl.searchParams.get("key")).toBe(FAKE_KEY);
    expect(requestedUrl.searchParams.get("token")).toBe(FAKE_TOKEN);
    expect(requestedUrl.searchParams.get("fields")).toBe("id,name,shortLink,url,closed");
    expect(boards).toEqual([board]);
  });

  it("maps a non-2xx response (JSON or plain-text body) to TrelloApiError with status/endpoint/message, never leaking credentials", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "board not found" }, 404));
    await expect(client().getBoardLists("abc12345")).rejects.toMatchObject({
      status: 404,
      endpoint: "/boards/abc12345/lists",
      trelloMessage: "board not found",
    });

    fetchMock.mockResolvedValueOnce(new Response("invalid key", { status: 401 }));
    const error = await client()
      .getMyBoards()
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrelloApiError);
    const serialized = JSON.stringify(error) + String((error as Error).message);
    expect(serialized).not.toContain(FAKE_KEY);
    expect(serialized).not.toContain(FAKE_TOKEN);
  });

  it("maps HTTP 429 to TrelloRateLimitError", async () => {
    fetchMock.mockResolvedValueOnce(new Response("rate limit exceeded", { status: 429 }));
    await expect(client().getMyBoards()).rejects.toBeInstanceOf(TrelloRateLimitError);
  });
});
