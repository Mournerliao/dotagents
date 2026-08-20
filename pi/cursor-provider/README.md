# @mournerliao/pi-cursor-provider

Cursor Agent CLI provider for [pi](https://pi.dev). This is `pi/cursor-provider/` in [dotagents](https://github.com/Mournerliao/dotagents). Install with `pi install`, not the skills CLI.

The backend is `agent acp`. Cursor executes tools; Pi answers `session/request_permission`.

## Install

From a git checkout:

```bash
pi install "$(pwd)/pi/cursor-provider"
```

From npm:

```bash
pi install npm:@mournerliao/pi-cursor-provider
```

One-shot, without writing settings:

```bash
pi -e "$(pwd)/pi/cursor-provider"
```

If `@netandreus/pi-cursor-provider` is installed, remove it first. Both packages register the `cursor` provider.

## Usage

`/model cursor/<id>`, for example `/model cursor/auto`.

### Auth

`agent login`, or `CURSOR_API_KEY` (passed in the environment, never on argv). In Pi: `/cursor-login`, `/cursor-status`, `/cursor-logout`.

### Models

`agent models` is folded so effort variants of one family become a single Pi model with a thinking-level map (`/model cursor/claude-opus-5-thinking` cycles `low` … `max`). Levels the family lacks are marked unsupported. `-thinking` and `-fast` stay separate models. Context windows follow Cursor's `1M` label, shared across a family's variants.

The catalogue is cached 24 hours at `${XDG_CACHE_HOME:-~/.cache}/dotagents-pi/cursor-models.json`. If the CLI is down, a stale cache is used; the last resort is `auto`.

### Consent

Allowlist hits never prompt. When Cursor would ask a human, Pi shows the CLI's options. **Allow always** writes `~/.cursor/cli-config.json`.

Without a UI (`pi -p`), prompts are rejected unless `/cursor-allow` granted `allow-once` for this turn or session. Interactive sessions always ask.

Tool activity is shown as assistant text (`⏳ …`) and stripped from later prompts. Thinking arrives as `agent_thought_chunk`.

| Command | Effect |
|---------|--------|
| `/cursor-login` | `agent login` (`NO_OPEN_BROWSER=1`) |
| `/cursor-status` | `agent status` |
| `/cursor-logout` | `agent logout` |
| `/cursor-allow` | Next print-mode turn auto-answers `allow-once` |
| `/cursor-allow session` | This Pi session auto-answers `allow-once` in print mode |
| `/cursor-allow off` | Stop auto-answering |

### Environment

`CURSOR_AGENT_PATH` (or `AGENT_PATH`), `CURSOR_API_KEY`. `PI_CURSOR_ACP_DEBUG=1` logs `usage_update` (window occupancy, not billing).

### Limits

Each turn spawns a fresh `agent acp` process and sends Pi's full serialized context. Token usage is copied when `session/prompt` includes it; this CLI often returns only `{ stopReason }`, so the footer may show zero. Cost is zero on a subscription. ACP process reuse across turns is not implemented.

## Develop

```bash
npm test --prefix pi/cursor-provider
npm run typecheck --prefix pi/cursor-provider
```

Node.js 20+ (CI uses 22). Tests use Node's type stripping.

Adapted from [`@netandreus/pi-cursor-provider`](https://github.com/netandreus/pi-cursor-provider) (MIT).
