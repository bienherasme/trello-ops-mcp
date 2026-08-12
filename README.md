# trello-ops-mcp

A local, **read-only** [Model Context Protocol](https://modelcontextprotocol.io) server that gives LLM agents (Claude and others) deterministic operational facts about Trello boards — structural history, card movement, workflow flow, staleness, and due dates.

It never writes to Trello. It has no mutation endpoints, no write tools, and no way to change board state, even accidentally.

[![CI](https://github.com/YOUR_GITHUB_USERNAME/trello-ops-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_USERNAME/trello-ops-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-000000)](https://modelcontextprotocol.io)

## Overview

Trello boards accumulate a lot of operational history that's hard to see from the UI alone: who renamed a list and when, how many cards moved between stages this week, which cards have gone quiet, what's overdue. `trello-ops-mcp` exposes that history to an MCP-capable agent as a set of small, composable tools — each one answers a narrow, factual question, and each one is deterministic: same input, same output, every time.

The server deliberately stops at *facts*. It does not decide whether a list is a "bottleneck," whether a card is "blocked," or whether a person is "productive" — those are judgment calls that need context the server doesn't have, so they're left to the agent reasoning over the data. See [Design philosophy](#design-philosophy-facts-not-conclusions).

## Why this exists

Trello already contains most of the operational data a team would want to reason about — who did what, when, and how cards flow through a board. But that data is spread across paginated REST endpoints with inconsistent shapes, and an LLM agent asked to "check the board" has no reliable way to fetch, filter, and combine it correctly on its own, every time it's asked.

This MCP server does that translation once, consistently: it turns raw Trello API responses into small, deterministic, structured operational signals — movement counts, flow numbers, staleness thresholds, due-date facts — that an agent can call directly and compose into an answer, instead of re-deriving the same parsing and pagination logic every time.

## Features

- **Read-only MCP tools** across board discovery, structural audit (list history), movement/flow analytics, and due-date/staleness signals.
- **Board references in any form** — internal ID, shortLink, or full board URL, normalized in one place.
- **Bounded, paginated Trello Actions scanning** with an explicit `truncated` flag — never a silent partial result.
- **A pure, fixed-clock-tested domain layer** for every analytic computation (movement counts, list flow, overdue/upcoming/stale classification) — no HTTP, no side effects, fully unit-testable.
- **Credential-safe by construction** — env-var-only credentials, lazy validation (tools that don't need Trello still work without them), and error messages that are structurally incapable of leaking a key or token.
- **Zero write surface** — the Trello client only ever issues `GET` requests. There is no code path that can call a mutating Trello endpoint.

## Installation

Requires Node.js >= 18.

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/trello-ops-mcp.git
cd trello-ops-mcp
npm install
```

## Quick Start

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/trello-ops-mcp.git
cd trello-ops-mcp
npm install
cp .env.example .env        # then fill in TRELLO_API_KEY and TRELLO_TOKEN — see Configuration
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

That last command opens a browser UI where you can call any tool directly and see the response — the fastest way to confirm everything is wired up before connecting a real agent. To use it from Claude Desktop instead, see [Connecting to Claude Desktop](#connecting-to-claude-desktop).

## Configuration

| Variable | Required for | Notes |
|---|---|---|
| `TRELLO_API_KEY` | All tools except `health_check` | From [trello.com/app-key](https://trello.com/app-key) |
| `TRELLO_TOKEN` | All tools except `health_check` | Generate with **read-only** scope (see below) |
| `LOG_LEVEL` | — | `debug` \| `info` \| `warn` \| `error` (default `info`) |

**Getting Trello credentials:**

1. Go to [trello.com/app-key](https://trello.com/app-key) while logged into the Trello account you want to audit. Copy the **API Key**.
2. On the same page, click the **Token** link to generate a personal token. When prompted for scope, choose **read-only**. This isn't just a formality — it means that even if this server had a bug, the credential itself physically cannot modify your boards.
3. Put both values in `.env` (copy `.env.example` as a starting point):

   ```bash
   TRELLO_API_KEY=your_api_key_here
   TRELLO_TOKEN=your_read_only_token_here
   ```

Credentials are validated lazily, only when a Trello-backed tool actually runs — so the server starts and `health_check` works even with no `.env` at all. **Never commit your `.env` file**; it's already excluded via `.gitignore`.

## Connecting to Claude Desktop

1. Build the server first — Claude Desktop launches the compiled output, not the TypeScript source:

   ```bash
   npm run build
   ```

2. Open Claude Desktop's config file:

   | OS | Location |
   |---|---|
   | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
   | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
   | Linux (community builds) | `~/.config/Claude/claude_desktop_config.json` |

3. Add an entry under `mcpServers`, using the **absolute path** to your clone:

   ```json
   {
     "mcpServers": {
       "trello-ops-mcp": {
         "command": "node",
         "args": ["/absolute/path/to/trello-ops-mcp/dist/index.js"],
         "env": {
           "TRELLO_API_KEY": "your_api_key_here",
           "TRELLO_TOKEN": "your_read_only_token_here"
         }
       }
     }
   }
   ```

4. Restart Claude Desktop completely (quit, not just close the window). A new MCP tool icon should appear in the chat input, and `trello-ops-mcp`'s tools should be listed there.

**Common mistakes:**

- **Relative path in `args`.** Claude Desktop doesn't run from your project directory — it needs the full absolute path to `dist/index.js`.
- **Forgetting to build.** If `dist/index.js` doesn't exist yet, Claude Desktop will fail to launch the server silently. Run `npm run build` first, and re-run it after pulling new changes.
- **Trailing commas or comments in the JSON config.** Standard JSON doesn't allow either — a config that "looks right" but has one extra comma will fail to parse.
- **Editing the config while Claude Desktop is running.** Config changes only take effect after a full restart.
- **Env vars set in your shell but not in the config's `env` block.** Claude Desktop launches the server as its own process — it doesn't inherit your terminal's environment. Credentials must go in the `env` block shown above.

**Troubleshooting:**

- Test the server manually first, outside Claude Desktop: `node dist/index.js` should print `trello-ops-mcp server started` to stderr and then sit waiting for stdio input (Ctrl+C to exit). If that fails, fix it before involving Claude Desktop at all.
- Check Claude Desktop's own MCP logs (accessible from its developer/settings menu on most platforms) for the specific startup error.
- Call `health_check` first from within Claude. It needs no credentials, so if it fails, the problem is the server process/config, not your Trello token.
- If `health_check` works but every other tool fails, the problem is almost always the credentials in the `env` block — re-check them against [Configuration](#configuration).

## Using MCP Inspector

[MCP Inspector](https://github.com/modelcontextprotocol/inspector) drives the server over stdio from a browser UI — useful for testing tools directly without a full agent in the loop.

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

In the UI: pick a tool from the list, fill in its inputs (e.g. `board` — accepts an ID, shortLink, or full URL), and run it. You'll see both the structured JSON result and the human-readable text summary the tool also returns.

## Architecture

```
Trello REST API
      │
      ▼
Trello Client        src/trello   — typed, read-only HTTP wrapper (auth, pagination, error mapping)
      │
      ▼
Pure Domain Analytics src/domain   — deterministic classifiers & analytics, zero HTTP/MCP imports
      │
      ▼
MCP Tools             src/tools    — validates input, orchestrates client + domain, formats output
      │
      ▼
LLM Agent             (Claude, or any MCP-capable client)
```

Each layer only talks to the one directly below it. In particular, **the domain layer never imports the Trello client** — every domain function is pure (data in, data out), which is what makes it possible to unit-test all the analytics logic with fixtures and a fixed clock, with no network and no MCP mocking. A tool is the only place these two layers meet: it fetches raw data from the Trello client, hands it to a domain function, and formats the result.

```
get_list_flow  →  trello.getBoardActions()  →  classifyCardMovements() + computeListFlow()  →  MCP response
```

### Design philosophy: facts, not conclusions

The MCP layer computes and returns **facts** — movement counts, flow numbers, staleness thresholds, due-date math. It deliberately does not compute a board health score, classify a list as a "bottleneck," decide a card is "blocked," or judge whether someone is "productive." Concretely:

- No `board_insights`, `board_risks`, `what_needs_attention`, `detect_bottleneck`, or `recommend_actions` tools exist, and none are planned.
- `get_list_flow` reports `incomingMoves`/`outgoingMoves`/`netFlow` per list — never a "bottleneck" label. A list with `netFlow: +17` is a fact; whether that's a problem depends on context the server doesn't have.
- `get_stale_cards` reports cards with no recognized recent activity — never "blocked." A quiet card might be low priority, waiting on something external, or genuinely forgotten — Trello data alone can't tell those apart.
- `cardsMoved` (`get_card_movements`/`get_top_card_movers`) measures **workflow activity**, not productivity or performance — a card can be moved by someone other than whoever did the underlying work.

An agent can combine these facts into a real answer (e.g. cross-referencing `get_stale_cards` with `get_overdue_cards`), but that interpretation happens in the agent's reasoning, not inside this server.

## Available MCP Tools

`board` accepts a Trello internal board ID, a shortLink, or a full board URL. `since`/`before` accept ISO 8601 timestamps. Every historical tool bounds its Trello Actions scan via `maxActions` (default 1000) and reports `truncated: true` rather than silently dropping data if the cap is hit.

### Discovery

| Tool | Input | Returns |
|---|---|---|
| `health_check` | — | Server status. No credentials required. |
| `get_boards` | — | Boards accessible to the configured account. |
| `get_board_lists` | `board`, `includeClosed?` | Lists on a board. |
| `get_board_members` | `board` | Members on a board. |
| `get_board_cards` | `board`, `includeClosed?` | Raw cards on a board. |

### Structural audit

| Tool | Input | Returns |
|---|---|---|
| `get_board_actions` | `board`, `since?`, `before?`, `actionTypes?`, `maxActions?` | Low-level, compact view of raw board action history. |
| `get_list_changes` | `board`, `since?`, `before?`, `listId?`, `maxActions?` | Who created/renamed/archived/unarchived lists, with `from`/`to` on renames. |

### Movement & flow analytics

| Tool | Input | Returns |
|---|---|---|
| `get_card_movements` | `board`, `since?`, `before?`, `memberId?`, `cardId?`, `fromListId?`, `toListId?`, `maxActions?` | Confirmed list-to-list card movements, optionally filtered. |
| `get_top_card_movers` | `board`, `since?`, `before?`, `days?`, `limit?`, `maxActions?` | Members ranked by movement count (default: last 7 days). |
| `get_list_flow` | `board`, `since?`, `before?`, `days?`, `maxActions?` | Incoming/outgoing/net movement counts per list (default: last 7 days). |
| `get_member_activity` | `board`, `memberId?`, `memberName?`, `since?`, `before?`, `days?`, `maxActions?` | One member's chronological activity feed. |

### Due-date & staleness signals

| Tool | Input | Returns |
|---|---|---|
| `get_overdue_cards` | `board`, `listId?`, `memberId?` | Cards past due, incomplete, not archived (current state). |
| `get_upcoming_due_cards` | `board`, `withinDays?`, `listId?`, `memberId?` | Cards due within N days, default 7 (current state). |
| `get_stale_cards` | `board`, `staleDays?`, `listId?`, `memberId?`, `maxActions?` | Open cards with no recognized activity for N days, default 14. |

Due-date tools read the board's **current card state** (always complete, always current). Movement/flow/staleness/member tools read **Trello's Actions history**, which is bounded by `maxActions` and by however far back Trello itself retains action data — see `truncated` in each tool's output.

## Example interactions

### Walkthrough: "What should I review today?"

There is no `what_should_i_review` tool, and there never will be — this question is exactly the kind of subjective synthesis this server leaves to the agent. Here's what actually happens:

1. **User asks:** "What should I review today?"
2. **The agent decides which facts it needs** and picks tools accordingly — in this case, three:
   - `get_overdue_cards` — cards already past due
   - `get_upcoming_due_cards` — cards due soon
   - `get_stale_cards` — cards with no recent recognized activity
3. **The MCP returns three sets of facts** — card IDs, names, dates, thresholds — with no ranking, prioritization, or commentary attached.
4. **The agent reasons over the combined results** (e.g. noticing a card that's both overdue *and* stale) and only then produces a natural-language answer.

Every answer this server participates in takes this shape: **user question → agent chooses tools → MCP returns operational signals → agent reasons over them → natural-language answer.** Step 3 is where this server's job ends.

**"Who moved the most cards this month?"**
→ Agent calls `get_top_card_movers` with `days: 30`, then reports the ranked list with each member's `cardsMoved` count.

**"What cards haven't moved recently?"**
→ Agent calls `get_stale_cards` (default 14-day threshold), noting which results have `historyComplete: false` (uncertain) versus `true` (confirmed).

**"Show overdue work."**
→ Agent calls `get_overdue_cards`, presenting cards sorted most-overdue-first with `daysOverdue` for each.

**"Which lists received the most work this week?"**
→ Agent calls `get_list_flow` with `days: 7` (or no `days` at all — that's the default), and reads off the lists with the highest `incomingMoves`.

**"Are there overdue cards that also look inactive?"**
→ Agent calls both `get_overdue_cards` and `get_stale_cards`, then intersects the results by `cardId` — a piece of reasoning this server deliberately leaves to the agent rather than doing itself.

## Screenshots

Screenshots demonstrating the MCP Inspector and Claude Desktop integration will be added in a future release.

## Security

- **Read-only by construction, not just by convention.** `src/trello/client.ts` is the only code in the project that makes HTTP calls to Trello, and every one of its methods issues a `GET` request. There is no method, no code path, and no tool that can call a mutating Trello endpoint.
- **Credentials never leave the environment.** `TRELLO_API_KEY`/`TRELLO_TOKEN` are read from `.env` (via `dotenv`) or the process environment — never hardcoded, never committed (`.gitignore` excludes `.env`), and validated lazily so tools that don't need Trello still work without them.
- **No credential logging, ever.** The logger writes only to stderr for operational messages (server start, log level) and never touches request data. Trello API errors are deliberately shaped to include only the HTTP status, the request *path* (never the query string, which is where the key/token live), and Trello's own error message — verified by dedicated tests.
- **A read-only-scoped Trello token is still recommended.** Even though this server's code can't issue a write, a read-only token means a compromised environment or a future bug still can't touch your boards.
- **Action history is bounded, and truncation is never silent.** Every tool that scans Trello's Actions API reports `truncated: true` when it stops early due to `maxActions`, and `get_stale_cards` explicitly marks a card `historyComplete: false` rather than asserting confidence it doesn't have.

If you find a security issue, please open an issue on the repository rather than a public discussion of the specifics.

## Development

```bash
npm run dev         # run directly from TypeScript source (tsx), no build step
npm run build        # compile to dist/
npm start             # run the compiled server (dist/index.js)
npm run typecheck      # type-check without emitting output
npm test                # run the test suite
```

Project layout:

```
src/
  index.ts        # server bootstrap, stdio transport
  config/         # env loading (general config + lazy Trello credentials), version
  trello/         # Trello API client: HTTP, auth, board-ref normalization, errors, types
  domain/         # pure classifiers/analytics: events, movements, flow, staleness, due dates
  tools/          # MCP tool definitions, one file per feature area
  utils/          # logger, centralized date-range validation
tests/
  tools/          # tool-layer tests (mocked Trello client, real in-memory MCP transport)
  trello/         # Trello client tests (board-ref normalization, pagination, mocked fetch)
  domain/         # domain logic tests (fixture-based, fixed-clock, no network)
  utils/          # date validation/resolution tests
  fixtures/       # sanitized Trello payloads modeled on real captured shapes
```

The tools/domain/client separation is enforced by convention, not tooling — when adding to this codebase, keep domain functions free of HTTP/MCP imports, and keep Trello-shape-specific parsing inside `src/trello/`.

## Testing

```bash
npm test
```

A focused, high-value behavioral test suite — intentionally kept small rather than exhaustive (coverage percentage is not a goal here). The suite is fully offline — no test ever calls the real Trello API:

- **Domain tests** exercise pure classifiers and analytics against fixture data (modeled on real Trello payloads captured during development, then sanitized) and, where time matters, a fixed injected clock.
- **Trello client tests** mock `fetch` to verify auth/query construction, HTTP and rate-limit error mapping, and Actions pagination/truncation behavior.
- **Tool tests** mock the Trello client and drive real `McpServer`/`Client` instances over an in-memory transport, proving the MCP wiring (validation, orchestration, structured output, safe error formatting) end-to-end for a representative tool from each category.

## Roadmap

Ideas under consideration for future versions. None of these are committed, scheduled, or promised on any timeline — this is a list of directions, not a plan.

- **Remote MCP transport** (currently stdio-only, by design, for v0.1)
- **SQLite cache** for faster repeat queries on large boards
- **Webhook ingestion** as an alternative to polling Trello's Actions API
- **Cross-board analytics** (currently every tool is scoped to one board)
- **Historical snapshots** for tracking board state over time, not just recent actions
- **Trend analysis** (week-over-week movement/flow comparisons)
- **Agent-generated reporting** — explicitly on the *agent* side of the boundary described in [Design philosophy](#design-philosophy-facts-not-conclusions), not inside this server

## License

[MIT](LICENSE)
