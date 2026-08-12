import { describe, expect, it } from "vitest";
import { TrelloConfigError } from "../../src/config/env.js";
import { InvalidBoardReferenceError } from "../../src/trello/boardRef.js";
import { TrelloApiError, TrelloRateLimitError } from "../../src/trello/errors.js";
import { formatToolError } from "../../src/tools/errorFormatting.js";

const FAKE_SECRET = "fake-test-credential-value";

describe("formatToolError", () => {
  it("formats every known error type into a readable message that never echoes credentials", () => {
    const cases: Array<[Error, string]> = [
      [new TrelloConfigError("Trello credentials are not configured."), "not configured"],
      [new InvalidBoardReferenceError("bad ref", "not alphanumeric"), "Invalid Trello board reference"],
      [
        new TrelloApiError({ status: 404, endpoint: "/boards/x/lists", trelloMessage: "board not found" }),
        "HTTP 404",
      ],
      [new TrelloRateLimitError({ endpoint: "/boards/x/actions" }), "rate limit"],
      [new Error("a generic failure"), "Unexpected error"],
    ];

    for (const [error, expectedSubstring] of cases) {
      const message = formatToolError(error);
      expect(message).toContain(expectedSubstring);
      expect(message).not.toContain(FAKE_SECRET);
      expect(message).not.toMatch(/key=|token=/);
    }
  });
});
