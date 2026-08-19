# Changelog

All notable changes to `@mournerliao/pi-cursor-provider` are documented here.

## 0.1.0 — 2026-08-19

### Added

- Package layout under `pi/` of the dotagents collection, published as `@mournerliao/pi-cursor-provider`.
- `extensions/cursor-provider.ts` — Cursor Agent CLI provider with a one-turn `--force` retry after Pi confirmation.
- Model catalogue cache (24 h, under `${XDG_CACHE_HOME:-~/.cache}/dotagents-pi/`), removing the multi-second `agent models` call from every Pi start and giving a real fallback when the CLI is unreachable.
- An oversized context now fails with a message pointing at `/compact` instead of an opaque `E2BIG` from the spawn, since the prompt travels as a single argv entry.

### Fixed

- Model ids now come from the account instead of a hand-written table that had gone stale: every id in `MODEL_MAP` and `STATIC_MODELS` was absent from the current `agent models` output, so the reasoning-variant mapping was dead code and the offline fallback offered models that could not be spawned.
- Reasoning is no longer lost on `-fast` models. Effort variants are grouped per family into a `thinkingLevelMap`, so Pi shows the levels an account actually has; previously `inferReasoning` anchored on the end of the id and marked every `…-high-fast` model as non-reasoning, which made Pi hide thinking entirely for about a third of the catalogue.
- Context windows follow Cursor's `1M` label instead of a flat 200k, shared across a family's variants since Cursor labels only some of them. Under-reporting the window made Pi compact far too early.
- A non-zero CLI exit is no longer reported as a successful turn when partial text had already arrived. Exits caused by a rejected tool are still treated as retryable.
- `CURSOR_API_KEY` travels in the child environment rather than as an `--api-key` argument, keeping it out of the process table.
- Tool markers such as `⏳ [Shell] …` are stripped from later prompts, so Cursor no longer reads this provider's transcript decoration back as its own output.
- A `/cursor-allow once` grant is bound to the start of a turn, so an automatic compaction request can no longer consume it.
