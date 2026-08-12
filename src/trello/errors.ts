/**
 * Thrown for any non-2xx Trello API response. Carries only non-secret
 * context: HTTP status, the request path (never the query string, which
 * holds the API key/token), and Trello's own error message when available.
 */
export class TrelloApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly trelloMessage: string | undefined;

  constructor(params: { status: number; endpoint: string; trelloMessage?: string | undefined }) {
    const suffix = params.trelloMessage ? `: ${params.trelloMessage}` : "";
    super(`Trello API error (${params.status}) on ${params.endpoint}${suffix}`);
    this.name = "TrelloApiError";
    this.status = params.status;
    this.endpoint = params.endpoint;
    this.trelloMessage = params.trelloMessage;
  }
}

/**
 * Specialization for HTTP 429. Kept as its own type so callers (and future
 * retry/backoff logic) can distinguish rate limiting from other failures
 * without inspecting `.status` directly.
 */
export class TrelloRateLimitError extends TrelloApiError {
  constructor(params: { endpoint: string; trelloMessage?: string | undefined }) {
    super({ status: 429, endpoint: params.endpoint, trelloMessage: params.trelloMessage });
    this.name = "TrelloRateLimitError";
  }
}
