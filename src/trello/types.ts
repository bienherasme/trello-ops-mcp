import { z } from "zod";

/**
 * Trello response shapes, restricted to the fields this client requests via
 * the API's `fields` parameter. Validated at runtime so a shape change on
 * Trello's side fails loudly instead of silently propagating `undefined`s.
 */

export const trelloBoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortLink: z.string(),
  url: z.string(),
  closed: z.boolean(),
});
export type TrelloBoard = z.infer<typeof trelloBoardSchema>;

export const trelloListSchema = z.object({
  id: z.string(),
  name: z.string(),
  closed: z.boolean(),
  pos: z.number(),
});
export type TrelloList = z.infer<typeof trelloListSchema>;

export const trelloMemberSchema = z.object({
  id: z.string(),
  fullName: z.string().nullable(),
  username: z.string(),
});
export type TrelloMember = z.infer<typeof trelloMemberSchema>;

export const trelloCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  idList: z.string(),
  idMembers: z.array(z.string()),
  due: z.string().nullable(),
  dueComplete: z.boolean(),
  closed: z.boolean(),
  url: z.string(),
});
export type TrelloCard = z.infer<typeof trelloCardSchema>;

/**
 * Trello Action payloads (the /boards/{id}/actions history feed). Unlike
 * the entities above, an action's `data` shape genuinely varies by action
 * type and by which field changed — e.g. a rename has `data.old.name`, an
 * archive has `data.old.closed`, a card move has `data.listBefore`/
 * `data.listAfter`. Shapes below were captured from real Trello API
 * responses for createList, createCard, updateList (rename,
 * archive/unarchive), and updateCard (move).
 *
 * These schemas are deliberately loose (`.passthrough()`, mostly-optional
 * fields) rather than one strict schema per action type: only `id`/`type`/
 * `date`/`idMemberCreator`/`memberCreator` are guaranteed, everything under
 * `data` is best-effort so an unfamiliar or evolving Trello action shape
 * degrades to "classifier ignores it" rather than a parse failure.
 */

export const trelloActionMemberCreatorSchema = z
  .object({
    id: z.string(),
    fullName: z.string().nullable(),
    username: z.string(),
  })
  .passthrough();
export type TrelloActionMemberCreator = z.infer<typeof trelloActionMemberCreatorSchema>;

export const trelloActionBoardRefSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    shortLink: z.string().optional(),
  })
  .passthrough();

export const trelloActionListRefSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    closed: z.boolean().optional(),
  })
  .passthrough();

export const trelloActionCardRefSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    idList: z.string().optional(),
    closed: z.boolean().optional(),
    idShort: z.number().optional(),
    shortLink: z.string().optional(),
  })
  .passthrough();

/**
 * `data.old` holds whichever fields changed in an update action. Only the
 * ones our classifiers currently care about are named; anything else
 * passes through unexamined.
 */
export const trelloActionOldValuesSchema = z
  .object({
    name: z.string().optional(),
    closed: z.boolean().optional(),
    idList: z.string().optional(),
  })
  .passthrough();

export const trelloActionDataSchema = z
  .object({
    board: trelloActionBoardRefSchema.optional(),
    list: trelloActionListRefSchema.optional(),
    listBefore: trelloActionListRefSchema.optional(),
    listAfter: trelloActionListRefSchema.optional(),
    card: trelloActionCardRefSchema.optional(),
    old: trelloActionOldValuesSchema.optional(),
  })
  .passthrough();

export const trelloActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string(),
  idMemberCreator: z.string(),
  memberCreator: trelloActionMemberCreatorSchema,
  data: trelloActionDataSchema,
});
export type TrelloAction = z.infer<typeof trelloActionSchema>;
