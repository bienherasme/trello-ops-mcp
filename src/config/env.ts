import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * General server config — deliberately excludes Trello credentials so the
 * server (and tools like health_check) can start without them configured.
 */
const envSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

const trelloCredentialsSchema = z.object({
  TRELLO_API_KEY: z.string().min(1, "TRELLO_API_KEY is required"),
  TRELLO_TOKEN: z.string().min(1, "TRELLO_TOKEN is required"),
});

export interface TrelloCredentials {
  apiKey: string;
  token: string;
}

/**
 * Thrown when a Trello-backed tool is invoked without credentials
 * configured. The message never echoes environment values — only which
 * variables are required.
 */
export class TrelloConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrelloConfigError";
  }
}

/**
 * Reads and validates Trello credentials from the environment on demand.
 * Not called at server startup — only when a Trello-backed tool actually
 * runs — so tools that don't need Trello keep working without these set.
 */
export function getTrelloCredentials(): TrelloCredentials {
  const parsed = trelloCredentialsSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new TrelloConfigError(
      "Trello credentials are not configured. Set TRELLO_API_KEY and TRELLO_TOKEN " +
        "(see .env.example) before using Trello-backed tools.",
    );
  }
  return { apiKey: parsed.data.TRELLO_API_KEY, token: parsed.data.TRELLO_TOKEN };
}
