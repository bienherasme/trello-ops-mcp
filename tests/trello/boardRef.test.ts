import { describe, expect, it } from "vitest";
import { InvalidBoardReferenceError, normalizeBoardRef } from "../../src/trello/boardRef.js";

describe("normalizeBoardRef", () => {
  it("normalizes a bare ID, a bare shortLink, and full board URLs (with/without a name segment, with/without www) to the same identifier", () => {
    expect(normalizeBoardRef("5f8a1b2c3d4e5f6a7b8c9d0e")).toBe("5f8a1b2c3d4e5f6a7b8c9d0e");
    expect(normalizeBoardRef("abc12345")).toBe("abc12345");
    expect(normalizeBoardRef("https://trello.com/b/abc12345/my-board-name")).toBe("abc12345");
    expect(normalizeBoardRef("https://trello.com/b/abc12345")).toBe("abc12345");
    expect(normalizeBoardRef("https://www.trello.com/b/abc12345/my-board")).toBe("abc12345");
    expect(normalizeBoardRef("  abc12345  ")).toBe("abc12345");
  });

  it("rejects empty, malformed, non-Trello, and non-board-URL references", () => {
    const invalidRefs = [
      "",
      "   ",
      "not a valid ref!",
      "https://",
      "https://not-trello.com/b/abc12345/my-board",
      "https://trello.com/somewhere-else",
      "https://trello.com/b/",
    ];
    for (const ref of invalidRefs) {
      expect(() => normalizeBoardRef(ref)).toThrow(InvalidBoardReferenceError);
    }
  });
});
