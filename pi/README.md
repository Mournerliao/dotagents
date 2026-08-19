# @mournerliao/pi-extensions

Personal [pi](https://pi.dev) extensions. This package is the `pi/` directory of [dotagents](https://github.com/Mournerliao/dotagents). It is not part of the skills catalog; install it with `pi install`, not `agent-skills`.

Put original extensions in `extensions/`. Extract testable logic into `src/` when it needs unit tests.

## Install

From a git checkout of this repo:

```bash
pi install "$(pwd)/pi"
```

After publish:

```bash
pi install npm:@mournerliao/pi-extensions
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

Routes Pi model requests through the Cursor Agent CLI (`agent`) so a Cursor subscription can be used from Pi. Select a model with `/model cursor/<id>`, for example `/model cursor/auto`.

Authentication is the CLI's job: `agent login`, or `CURSOR_API_KEY`. Inside Pi: `/cursor-login`, `/cursor-status`, `/cursor-logout`. The key is passed to the CLI through the environment, never on the command line.

#### Models and thinking levels

Cursor encodes reasoning effort into the model id (`gpt-5.6-sol-xhigh`, `claude-opus-5-thinking-max`) and offers a `-fast` variant of most families. This extension reads `agent models` and folds each family's effort variants into a single Pi model with a `thinkingLevelMap`, so a list of ~200 CLI ids becomes ~60 Pi models and the effort is chosen with Pi's thinking level instead of by picking a different model.

`/model cursor/claude-opus-5-thinking` then cycles through `low`, `medium`, `high`, `xhigh` and `max`; levels a family does not have are marked unsupported so Pi never offers them. The `-thinking` and `-fast` axes stay separate models because they are separate choices. Context windows come from Cursor's own `1M` label, shared across a family's variants since Cursor only labels some of them.

The catalogue is cached for 24 hours under `${XDG_CACHE_HOME:-~/.cache}/dotagents-pi/cursor-models.json`, because `agent models` takes several seconds and would otherwise delay every Pi start. If the CLI is unreachable, a stale cache is preferred over the built-in fallback, which is only `auto`.

#### Limits

The CLI takes the prompt as a command-line argument, so the whole serialized context has to fit in one argv entry. Past 256 KB this provider fails the turn with a message pointing at `/compact` rather than letting the spawn die with an opaque `E2BIG`. Sessions are not resumed (`--resume`) on purpose: Pi owns the context and rewrites it when compacting, so a Cursor-side session would drift from what Pi believes it sent.

Token usage is reported as zero. The CLI does not expose it, and cost is zero on a subscription anyway, but that also means Pi's context accounting for these models is not driven by real numbers.

#### Consent

Cursor CLI executes tools itself. Pi only observes the stream. `--print` has no approval card, so this extension does **not** write `Delete(**)` into `~/.cursor/cli-config.json`.

When a tool is rejected (Auto-review, allowlist, and similar), the TUI asks whether to retry **this turn** with `--force`. That is one spawn. It is not a lasting Cursor permission. Without a UI, the stream records the rejection and tells you to run `/cursor-allow`.

Because Cursor runs the tools, their activity arrives as assistant text (`⏳ [Shell] …`). Those marker lines are shown but stripped from later prompts, so the model never reads this transcript decoration back.

A `once` grant is decided when a turn starts, not when a request is streamed, so an automatic compaction cannot spend it.

| Command | Effect |
|---------|--------|
| `/cursor-allow` | Next turn spawns with `--force` |
| `/cursor-allow session` | This Pi session spawns with `--force` |
| `/cursor-allow off` | Stop adding `--force` |

`--force` auto-approves Cursor tools for that spawn, including ones Auto-review would block. Already-applied edits may run again on a retry.

Environment: `CURSOR_AGENT_PATH` (or `AGENT_PATH`), `CURSOR_API_KEY`.

Adapted from [`@netandreus/pi-cursor-provider`](https://github.com/netandreus/pi-cursor-provider) (MIT).

## Develop

```bash
npm test --prefix pi
npm run typecheck --prefix pi
```

Requires Node.js 20+. Tests use Node's type stripping (CI uses Node 22).
