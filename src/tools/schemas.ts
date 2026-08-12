import { z } from "zod";

export const boardRefSchema = z
  .string()
  .min(1, "board is required")
  .describe(
    "Trello board ID, shortLink, or full board URL (e.g. https://trello.com/b/abc123/my-board)",
  );

export const includeClosedSchema = z
  .boolean()
  .optional()
  .describe("Include archived/closed items in addition to open ones (default: false)");

export const sinceSchema = z
  .string()
  .optional()
  .describe("ISO 8601 timestamp — only include actions at or after this time (e.g. 2026-01-01T00:00:00.000Z)");

export const beforeSchema = z
  .string()
  .optional()
  .describe("ISO 8601 timestamp — only include actions strictly before this time");

export const maxActionsSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Cap on the total number of actions scanned across pagination (default: 1000)");

export const actionTypesSchema = z
  .array(z.string())
  .optional()
  .describe(
    "Trello action type names to filter to, e.g. [\"createList\", \"updateList\"]. Unfiltered if omitted.",
  );

export const listIdSchema = z
  .string()
  .optional()
  .describe("Restrict results to structural changes on this specific Trello list ID");

export const memberIdSchema = z
  .string()
  .optional()
  .describe("Restrict results to this Trello member ID");

export const memberNameSchema = z
  .string()
  .optional()
  .describe(
    "Full name or username of a board member, used to resolve memberId when it isn't known. " +
      "Rejected with a clear error if it matches zero or more than one board member.",
  );

export const cardIdSchema = z.string().optional().describe("Restrict results to this Trello card ID");

export const fromListIdSchema = z
  .string()
  .optional()
  .describe("Restrict results to movements out of this Trello list ID");

export const toListIdSchema = z
  .string()
  .optional()
  .describe("Restrict results to movements into this Trello list ID");

export const daysSchema = z
  .number()
  .positive()
  .optional()
  .describe(
    "Convenience alternative to since/before: look back this many days from now. " +
      "Cannot be combined with since/before.",
  );

export const limitSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Cap on the number of ranked results returned (default: all)");

export const withinDaysSchema = z
  .number()
  .positive()
  .optional()
  .describe("How many days ahead of now to look for upcoming due dates (default: 7)");

export const staleDaysSchema = z
  .number()
  .positive()
  .optional()
  .describe("A card with no recognized activity for at least this many days counts as stale (default: 14)");
