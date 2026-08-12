import { z } from "zod";

/**
 * MCP output-schema mirror of src/domain/types.ts AuditEvent. Lives in the
 * tools layer (not domain) since zod/output-schema shaping is an MCP
 * serialization concern, not a domain one. Shared by get_list_changes and
 * get_member_activity.
 */
export const auditActorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string(),
});

export const auditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: auditActorSchema,
  category: z.enum(["structural", "card_activity"]),
  type: z.enum([
    "list_created",
    "list_renamed",
    "list_archived",
    "list_unarchived",
    "card_created",
    "card_moved",
    "card_archived",
    "card_unarchived",
  ]),
  boardId: z.string(),
  boardName: z.string().optional(),
  entityType: z.enum(["list", "card"]),
  entityId: z.string(),
  entityName: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const requestedRangeSchema = z.object({
  since: z.string().optional(),
  before: z.string().optional(),
});
