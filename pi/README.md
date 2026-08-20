# @mournerliao/pi-cursor-provider

Cursor Agent CLI provider for [pi](https://pi.dev). This package is the `pi/` directory of [dotagents](https://github.com/Mournerliao/dotagents). It is not part of the skills catalog; install it with `pi install`, not `agent-skills`.

Put original extensions in `extensions/`. Extract testable logic into `src/` when it needs unit tests.

## Install

From a git checkout of this repo:

```bash
pi install "$(pwd)/pi"
```

After publish:

```bash
pi install npm:@mournerliao/pi-cursor-provider
```

Try once without writing settings:

```bash
pi -e "$(pwd)/pi"
```

If `@netandreus/pi-cursor-provider` is already installed, remove it first so both packages do not register the `cursor` provider:

```bash
pi remove npm:@netandreus/pi-cursor-provider
```

Filter to one extension in `~/.pi/agent/settings.json` (path is whatever `pi install` wrote):

```json
{
  "packages": [
    {
      "source": "/absolute/path/to/dotagents/pi",
      "extensions": ["extensions/cursor-provider.ts"]
    }
  ]
}
```

## Extensions

### cursor-provider

Routes Pi model requests through `agent acp` so a Cursor subscription can be used from Pi, with Cursor's permission prompts answered in the Pi TUI. Select a model with `/model cursor/<id>`, for example `/model cursor/auto`.

Authentication is the CLI's job: `agent login`, or `CURSOR_API_KEY`. Inside Pi: `/cursor-login`, `/cursor-status`, `/cursor-logout`. The key is passed to the CLI through the environment, never on the command line.

#### Models and thinking levels

Cursor encodes reasoning effort into the model id (`gpt-5.6-sol-xhigh`, `claude-opus-5-thinking-max`) and offers a `-fast` variant of most families. This extension reads `agent models` and folds each family's effort variants into a single Pi model with a `thinkingLevelMap`, so a list of ~200 CLI ids becomes ~60 Pi models and the effort is chosen with Pi's thinking level instead of by picking a different model.

`/model cursor/claude-opus-5-thinking` then cycles through `low`, `medium`, `high`, `xhigh` and `max`; levels a family does not have are marked unsupported so Pi never offers them. The `-thinking` and `-fast` axes stay separate models because they are separate choices. Context windows come from Cursor's own `1M` label, shared across a family's variants since Cursor only labels some of them.

The catalogue is cached for 24 hours under `${XDG_CACHE_HOME:-~/.cache}/dotagents-pi/cursor-models.json`, because `agent models` takes several seconds and would otherwise delay every Pi start. If the CLI is unreachable, a stale cache is preferred over the built-in fallback, which is only `auto`.

#### Limits

Each Pi turn starts a fresh `agent acp` process and sends Pi's whole serialized context as
one prompt, so Pi stays the source of truth across `/compact` and history edits. Handshake
to `session/new` is about 8–9 s on this machine; most of a short turn's wall time after that
is the model. Keeping the ACP process alive across turns is a later optimisation, not a
change to that mapping.

Token usage is copied onto the Pi message when `session/prompt` includes it. The current
CLI often returns only `{ stopReason }`, so the footer may still show zero until Cursor
starts filling those fields. Cost stays zero on a subscription. `PI_CURSOR_ACP_DEBUG=1`
logs `usage_update` notifications for inspection; their `size`/`used` fields look like
window occupancy, not billing.

A two-turn replay of the same history did not include `cachedReadTokens` on this CLI, so
cross-session prompt-cache hit rate is still unknown. Session reuse stays deferred until
that number exists.

#### Consent

Cursor CLI executes tools itself. Pi answers Cursor's permission prompts instead of
pretending those tools are Pi `tool_call`s.

`agent acp` sends `session/request_permission` before a tool that Cursor would ask a human
about. Pi shows the CLI's options in `ui.select`. Allowlist hits never prompt. Auto-review
and `approvalMode` only change whether Cursor asks; when it asks, the request still arrives
here. Choosing **Allow always** is Cursor writing `~/.cursor/cli-config.json`, and the
label says so.

Without a UI (`pi -p`), prompts are rejected with a hint unless `/cursor-allow` granted
`allow-once` for this turn or session. Interactive sessions always ask; `/cursor-allow`
does not silence the TUI.

Because Cursor runs the tools, their activity arrives as assistant text (`⏳ …`). Those
marker lines are shown but stripped from later prompts, so the model never reads this
transcript decoration back. Thinking arrives as `agent_thought_chunk` and is rendered as
Pi thinking blocks.

| Command | Effect |
|---------|--------|
| `/cursor-allow` | Next print-mode turn auto-answers `allow-once` |
| `/cursor-allow session` | This Pi session auto-answers `allow-once` in print mode |
| `/cursor-allow off` | Stop auto-answering |

Environment: `CURSOR_AGENT_PATH` (or `AGENT_PATH`), `CURSOR_API_KEY`.

Adapted from [`@netandreus/pi-cursor-provider`](https://github.com/netandreus/pi-cursor-provider) (MIT).

## Develop

```bash
npm test --prefix pi
npm run typecheck --prefix pi
```

Requires Node.js 20+. Tests use Node's type stripping (CI uses Node 22).
