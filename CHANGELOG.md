# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] — Initial release

First public release candidate. A local, read-only MCP server exposing 14 tools over stdio for auditing and analyzing Trello boards, built as a layered TypeScript project (Trello client → pure domain analytics → MCP tools).

### Added

**Server foundation**
- MCP server over stdio transport, built on the official `@modelcontextprotocol/sdk`.
- `health_check` — connectivity check requiring no Trello credentials.
- Typed, read-only Trello REST client: auth injection, board-reference normalization (ID, shortLink, or full URL), HTTP/rate-limit error mapping, and Trello Actions pagination — all without ever calling a mutating endpoint.
- Centralized ISO 8601 date-range validation and `since`/`before`/`days` resolution, shared by every time-scoped tool.

**Discovery**
- `get_boards`, `get_board_lists`, `get_board_members`, `get_board_cards` — typed pass-throughs over core Trello entities.

**Structural audit**
- `get_board_actions` — low-level, compact view of a board's raw action history.
- `get_list_changes` — who created, renamed, archived, or unarchived a list, with `from`/`to` names on renames.

**Movement and member analytics**
- `get_card_movements` — confirmed list-to-list card movements, filterable by member/card/source/destination list.
- `get_top_card_movers` — members ranked by card-movement count over a date range.
- `get_list_flow` — incoming/outgoing/net card-movement counts per list over a date range.
- `get_member_activity` — one member's chronological activity feed (moves, list changes, card creation/archival), resolvable by `memberId` or by `memberName` with ambiguity rejected rather than guessed.

**Due-date and staleness signals**
- `get_overdue_cards` / `get_upcoming_due_cards` — current-state due-date facts, computed from a deterministic, clock-injected domain layer (exact 24-hour-period math, documented boundary behavior).
- `get_stale_cards` — open cards with no recognized activity for a configurable threshold; explicitly distinguishes "confirmed stale" from "unknown due to a truncated history scan" rather than asserting staleness it can't back up.

**Design guarantees**
- Every analytics tool returns deterministic facts and metrics only — no bottleneck classification, blocked-work labeling, or productivity scoring. Interpretation is left to the calling agent.
- Pure domain layer (`src/domain`) with zero HTTP/MCP imports, independently unit-tested with fixed clocks and sanitized fixtures modeled on real captured Trello payloads.
- No database, cache, webhooks, remote transport, or write capability.

[0.1.0]: https://github.com/YOUR_GITHUB_USERNAME/trello-ops-mcp/releases/tag/v0.1.0
