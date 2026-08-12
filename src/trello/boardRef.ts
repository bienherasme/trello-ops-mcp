/**
 * Raised when a board reference is neither a bare ID/shortLink nor a
 * recognizable Trello board URL. The offending input is not secret, so it's
 * safe to include verbatim.
 */
export class InvalidBoardReferenceError extends Error {
  constructor(input: string, reason: string) {
    super(`Invalid Trello board reference "${input}": ${reason}`);
    this.name = "InvalidBoardReferenceError";
  }
}

const ID_LIKE = /^[A-Za-z0-9]+$/;

/**
 * Normalizes a board reference — internal ID, shortLink, or full board URL
 * (https://trello.com/b/SHORTLINK/board-name) — into the identifier segment
 * Trello's REST API accepts directly in place of `{id}`. Trello's board
 * endpoints accept either an ID or a shortLink interchangeably, so no
 * extra API lookup is performed here.
 */
export function normalizeBoardRef(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new InvalidBoardReferenceError(raw, "must not be empty");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return extractShortLinkFromUrl(trimmed);
  }

  if (!ID_LIKE.test(trimmed)) {
    throw new InvalidBoardReferenceError(
      raw,
      "expected a Trello board ID, shortLink, or full board URL",
    );
  }

  return trimmed;
}

function extractShortLinkFromUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new InvalidBoardReferenceError(input, "not a valid URL");
  }

  if (!/(^|\.)trello\.com$/i.test(parsed.hostname)) {
    throw new InvalidBoardReferenceError(input, "URL is not a trello.com board URL");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "b") {
    throw new InvalidBoardReferenceError(
      input,
      "expected a board URL of the form https://trello.com/b/<shortLink>/...",
    );
  }

  const shortLink = segments[1] as string;
  if (!ID_LIKE.test(shortLink)) {
    throw new InvalidBoardReferenceError(input, "shortLink segment is not alphanumeric");
  }

  return shortLink;
}
