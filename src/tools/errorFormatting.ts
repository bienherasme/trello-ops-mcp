import { TrelloConfigError } from "../config/env.js";
import { AmbiguousMemberNameError, MemberNotFoundError } from "../domain/memberResolution.js";
import { InvalidBoardReferenceError } from "../trello/boardRef.js";
import { TrelloApiError, TrelloRateLimitError } from "../trello/errors.js";
import { InvalidDateRangeError } from "../utils/dates.js";

/**
 * Converts a caught error into a message safe to return to an MCP client:
 * no stack traces, and — since TrelloApiError only ever carries the
 * request path and Trello's own message, never the query string — no
 * credentials either.
 */
export function formatToolError(error: unknown): string {
  if (error instanceof TrelloConfigError) {
    return error.message;
  }
  if (error instanceof InvalidBoardReferenceError) {
    return error.message;
  }
  if (error instanceof InvalidDateRangeError) {
    return error.message;
  }
  if (error instanceof MemberNotFoundError || error instanceof AmbiguousMemberNameError) {
    return error.message;
  }
  if (error instanceof TrelloRateLimitError) {
    return `Trello rate limit reached while calling ${error.endpoint}. Please wait and try again.`;
  }
  if (error instanceof TrelloApiError) {
    const suffix = error.trelloMessage ? `: ${error.trelloMessage}` : "";
    return `Trello API error (HTTP ${error.status}) while calling ${error.endpoint}${suffix}`;
  }
  if (error instanceof Error) {
    return `Unexpected error: ${error.message}`;
  }
  return "Unexpected error";
}
