import { z } from "zod";
import { getTrelloCredentials, type TrelloCredentials } from "../config/env.js";
import { validateDateRange } from "../utils/dates.js";
import { normalizeBoardRef } from "./boardRef.js";
import { TrelloApiError, TrelloRateLimitError } from "./errors.js";
import {
  trelloActionSchema,
  trelloBoardSchema,
  trelloCardSchema,
  trelloListSchema,
  trelloMemberSchema,
  type TrelloAction,
  type TrelloBoard,
  type TrelloCard,
  type TrelloList,
  type TrelloMember,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.trello.com/1";
const ERROR_BODY_MAX_LENGTH = 300;

/** Trello's own hard cap on `limit` for the actions endpoint. */
const TRELLO_ACTIONS_MAX_PAGE_SIZE = 1000;
/** Default overall cap on actions fetched across all pages of a single call. */
const DEFAULT_MAX_ACTIONS = 1000;

export interface TrelloClientConfig extends TrelloCredentials {
  baseUrl?: string;
}

export interface BoardListOptions {
  includeClosed?: boolean | undefined;
}

export interface BoardCardOptions {
  includeClosed?: boolean | undefined;
}

export interface GetBoardActionsOptions {
  since?: string | undefined;
  before?: string | undefined;
  /** Trello action type names, e.g. ["createList", "updateList"]. Unfiltered if omitted. */
  filter?: string[] | undefined;
  /** Page size per request to Trello, capped at 1000. Defaults to 1000. */
  limit?: number | undefined;
  /** Overall cap on total actions returned across all pages. Defaults to 1000. */
  maxActions?: number | undefined;
}

export interface GetBoardActionsResult {
  actions: TrelloAction[];
  actionsScanned: number;
  /** True if maxActions was reached and older actions may still exist beyond it. */
  truncated: boolean;
  requestedRange: { since?: string | undefined; before?: string | undefined };
}

/**
 * Typed, read-only wrapper over the Trello REST API. Centralizes auth
 * injection, query construction, HTTP error handling, and response
 * validation so no other layer touches Trello's HTTP surface directly.
 */
export class TrelloClient {
  private readonly apiKey: string;
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(config: TrelloClientConfig) {
    this.apiKey = config.apiKey;
    this.token = config.token;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async getMyBoards(): Promise<TrelloBoard[]> {
    const endpoint = "/members/me/boards";
    const raw = await this.get(endpoint, { fields: "id,name,shortLink,url,closed" });
    return this.parse(z.array(trelloBoardSchema), raw, endpoint);
  }

  async getBoardLists(boardRef: string, options: BoardListOptions = {}): Promise<TrelloList[]> {
    const id = normalizeBoardRef(boardRef);
    const endpoint = `/boards/${id}/lists`;
    const raw = await this.get(endpoint, {
      fields: "id,name,closed,pos",
      filter: options.includeClosed ? "all" : "open",
    });
    return this.parse(z.array(trelloListSchema), raw, endpoint);
  }

  async getBoardMembers(boardRef: string): Promise<TrelloMember[]> {
    const id = normalizeBoardRef(boardRef);
    const endpoint = `/boards/${id}/members`;
    const raw = await this.get(endpoint, { fields: "id,fullName,username" });
    return this.parse(z.array(trelloMemberSchema), raw, endpoint);
  }

  async getBoardCards(boardRef: string, options: BoardCardOptions = {}): Promise<TrelloCard[]> {
    const id = normalizeBoardRef(boardRef);
    const endpoint = `/boards/${id}/cards`;
    const raw = await this.get(endpoint, {
      fields: "id,name,idList,idMembers,due,dueComplete,closed,url",
      filter: options.includeClosed ? "all" : "open",
    });
    return this.parse(z.array(trelloCardSchema), raw, endpoint);
  }

  /**
   * Fetches a board's action (audit trail) history, paginating backward in
   * time via Trello's `before=<action id>` cursor until one of: the page
   * comes back empty, a page comes back shorter than requested (both mean
   * the requested range is exhausted), or `maxActions` is reached (which
   * sets `truncated: true` rather than silently stopping).
   */
  async getBoardActions(
    boardRef: string,
    options: GetBoardActionsOptions = {},
  ): Promise<GetBoardActionsResult> {
    const { since, before, filter, limit = TRELLO_ACTIONS_MAX_PAGE_SIZE, maxActions = DEFAULT_MAX_ACTIONS } =
      options;
    validateDateRange({ since, before });

    const id = normalizeBoardRef(boardRef);
    const endpoint = `/boards/${id}/actions`;
    const pageSize = Math.min(limit, TRELLO_ACTIONS_MAX_PAGE_SIZE);
    const filterParam = filter && filter.length > 0 ? filter.join(",") : undefined;

    const actions: TrelloAction[] = [];
    let cursor: string | undefined;
    let truncated = false;

    while (actions.length < maxActions) {
      const requestLimit = Math.min(pageSize, maxActions - actions.length);

      const raw = await this.get(endpoint, {
        fields: "id,type,date,idMemberCreator,data",
        memberCreator_fields: "fullName,username",
        limit: String(requestLimit),
        since,
        before: cursor ?? before,
        filter: filterParam,
      });

      const page = this.parse(z.array(trelloActionSchema), raw, endpoint);
      if (page.length === 0) break;

      actions.push(...page);
      cursor = page[page.length - 1]?.id;

      if (actions.length >= maxActions) {
        truncated = true;
        break;
      }
      if (page.length < requestLimit) break;
    }

    return {
      actions,
      actionsScanned: actions.length,
      truncated,
      requestedRange: { since, before },
    };
  }

  private async get(
    path: string,
    query: Record<string, string | undefined>,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("token", this.token);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new TrelloApiError({
        status: 0,
        endpoint: path,
        trelloMessage: "network error contacting the Trello API",
      });
    }

    if (response.status === 429) {
      throw new TrelloRateLimitError({ endpoint: path, trelloMessage: await readErrorBody(response) });
    }

    if (!response.ok) {
      throw new TrelloApiError({
        status: response.status,
        endpoint: path,
        trelloMessage: await readErrorBody(response),
      });
    }

    return response.json();
  }

  private parse<T>(schema: z.ZodType<T>, raw: unknown, endpoint: string): T {
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new TrelloApiError({
        status: 200,
        endpoint,
        trelloMessage: "Trello returned data in an unexpected shape",
      });
    }
    return result.data;
  }
}

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;

    try {
      const parsed: unknown = JSON.parse(text);
      if (
        parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof (parsed as { message: unknown }).message === "string"
      ) {
        return truncate((parsed as { message: string }).message);
      }
    } catch {
      // Trello sometimes returns plain-text error bodies; fall through.
    }

    return truncate(text);
  } catch {
    return undefined;
  }
}

function truncate(value: string, max = ERROR_BODY_MAX_LENGTH): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

let cachedClient: TrelloClient | undefined;

/**
 * Lazily constructs (and caches) the Trello client, reading credentials
 * from the environment on first use. Deferred like this so tools that
 * don't touch Trello — e.g. health_check — keep working without
 * TRELLO_API_KEY / TRELLO_TOKEN being set.
 */
export function getTrelloClient(): TrelloClient {
  if (!cachedClient) {
    cachedClient = new TrelloClient(getTrelloCredentials());
  }
  return cachedClient;
}
